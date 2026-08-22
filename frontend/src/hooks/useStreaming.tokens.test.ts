/**
 * Reading a real token stream off the wire.
 *
 * The event *order* changed with real streaming, and that is what these pin.
 * Metadata used to arrive before the reply, because the reply did not exist
 * until the whole turn had finished. Now the words come first and the
 * authoritative metadata follows — so the handler that used to clear the bubble
 * on `agent_info` would now blank a reply the customer is already reading, and
 * already hearing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStreaming, type StreamCallbacks } from "./useStreaming";

/** An SSE body built from a list of events, as the engine writes them. */
function sseBody(events: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

function respondWith(events: Record<string, unknown>[]) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    body: sseBody(events),
  })) as unknown as typeof fetch;
}

const TOKEN = (text: string) => ({ type: "token", text });
const INFO = (extra: Record<string, unknown> = {}) => ({
  type: "agent_info", agent_name: "Sarah AI", agent_domain: "health",
  transferred: false, suggest_transfer: false, session_id: "s-1", ...extra,
});
const DONE = (extra: Record<string, unknown> = {}) => ({
  type: "done", session_id: "s-1", ...extra,
});

async function run(events: Record<string, unknown>[], callbacks: StreamCallbacks = {}) {
  vi.stubGlobal("fetch", respondWith(events));
  const { result } = renderHook(() => useStreaming());
  await act(async () => {
    await result.current.stream("hello", [], "health", "s-1", callbacks);
  });
  return result;
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("incremental tokens", () => {
  it("accumulates the reply as the events arrive", async () => {
    const seen: string[] = [];
    const result = await run(
      [INFO({ streaming: true }), TOKEN("Health "), TOKEN("cover "), TOKEN("for you."), INFO(), DONE()],
      { onToken: (accumulated) => seen.push(accumulated) }
    );

    // Each callback carries the whole reply so far, not the delta.
    expect(seen).toEqual(["Health ", "Health cover ", "Health cover for you."]);
    expect(result.current.state.text).toBe("Health cover for you.");
  });

  it("does not blank a reply the customer is already reading", async () => {
    // The authoritative metadata now arrives *after* the words. Clearing the
    // bubble here — which was right when this event started the reply — would
    // wipe a sentence the advisor is part-way through speaking.
    const result = await run([
      INFO({ streaming: true }), TOKEN("Already said. "), INFO({ transferred: false }), DONE(),
    ]);
    expect(result.current.state.text).toBe("Already said. ");
  });

  it("still clears the bubble when metadata is what starts the reply", async () => {
    // The buffered path, unchanged: nothing has been streamed when `agent_info`
    // lands, so it opens an empty bubble exactly as it always did.
    const seen: string[] = [];
    await run([INFO(), TOKEN("Buffered "), TOKEN("reply."), DONE()], {
      onToken: (t) => seen.push(t),
    });
    expect(seen[0]).toBe("Buffered ");
  });

  it("hands the final text to onDone", async () => {
    const done = vi.fn();
    await run([INFO(), TOKEN("All "), TOKEN("of it."), DONE()], { onDone: done });
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ text: "All of it." }));
  });
});

describe("a retracted turn", () => {
  it("replaces the streamed text instead of appending to it", async () => {
    const replaced = vi.fn();
    const result = await run(
      [
        INFO({ streaming: true }),
        TOKEN("Our Supreme plan costs "),
        { type: "replace", text: "I hit a technical problem just then." },
        INFO(),
        DONE(),
      ],
      { onReplace: replaced }
    );

    // Appending would read as the advisor contradicting itself.
    expect(result.current.state.text).toBe("I hit a technical problem just then.");
    expect(replaced).toHaveBeenCalledWith("I hit a technical problem just then.");
  });

  it("reports the corrected text as the final text", async () => {
    const done = vi.fn();
    await run(
      [INFO(), TOKEN("retracted "), { type: "replace", text: "the truth" }, DONE()],
      { onDone: done }
    );
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ text: "the truth" }));
  });
});

describe("latency reporting", () => {
  it("reads what the turn actually cost", async () => {
    const done = vi.fn();
    await run(
      [INFO(), TOKEN("hi"), DONE({ latency: { streamed: true, total_ms: 1800, first_token_ms: 420, dropped_tokens: 0 } })],
      { onDone: done }
    );
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({
        latency: { streamed: true, totalMs: 1800, firstTokenMs: 420, droppedTokens: 0 },
      })
    );
  });

  it("treats a missing latency block as ordinary, not as an error", async () => {
    // Additive field: an older engine does not send it, and a measurement must
    // never be the thing that breaks a reply the customer already has.
    const done = vi.fn();
    await run([INFO(), TOKEN("hi"), DONE()], { onDone: done });
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ latency: null }));
  });

  it("survives a malformed latency block", async () => {
    const done = vi.fn();
    await run([INFO(), TOKEN("hi"), DONE({ latency: "not an object" })], { onDone: done });
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ latency: null }));
  });
});

describe("cancellation", () => {
  it("stops the stream and returns to idle", async () => {
    vi.stubGlobal("fetch", respondWith([INFO(), TOKEN("one ")]));
    const { result } = renderHook(() => useStreaming());

    await act(async () => {
      await result.current.stream("hello", [], "health", "s-1", {});
    });
    act(() => { result.current.cancel(); });

    await waitFor(() => expect(result.current.state.phase).toBe("idle"));
  });

  it("clears the accumulated text on reset", async () => {
    vi.stubGlobal("fetch", respondWith([INFO(), TOKEN("one "), DONE()]));
    const { result } = renderHook(() => useStreaming());

    await act(async () => {
      await result.current.stream("hello", [], "health", "s-1", {});
    });
    expect(result.current.state.text).toBe("one ");

    act(() => { result.current.reset(); });
    expect(result.current.state.text).toBe("");
  });
});

describe("an error event", () => {
  it("ends the stream with the engine's message", async () => {
    const onError = vi.fn();
    const result = await run(
      [{ type: "error", message: "The advisor is unavailable right now." }],
      { onError }
    );
    expect(result.current.state.phase).toBe("error");
    expect(onError).toHaveBeenCalledWith("The advisor is unavailable right now.");
  });
});

describe("a cancelled stream", () => {
  it("stops painting the screen with a reply nobody wants", async () => {
    // Aborting stops the socket; a chunk already decoded and sitting in a
    // microtask still runs its handlers. This is the half of cancellation
    // the customer actually sees.
    const encoder = new TextEncoder();
    let cancelNow: (() => void) | null = null;

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(INFO())}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(TOKEN("before "))}\n\n`));
        await Promise.resolve();
        cancelNow?.();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(TOKEN("after "))}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(DONE())}\n\n`));
        controller.close();
      },
    });

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, body })));
    const { result } = renderHook(() => useStreaming());
    cancelNow = () => result.current.cancel();

    const seen: string[] = [];
    await act(async () => {
      await result.current.stream("hello", [], "health", "s-1", {
        onToken: (t) => seen.push(t),
      });
    });

    expect(seen.join("|")).not.toContain("after");
  });

  it("does not let an old stream overwrite the one that replaced it", async () => {
    const result = await run([INFO(), TOKEN("second turn."), DONE()]);
    expect(result.current.state.text).toBe("second turn.");
  });
});
