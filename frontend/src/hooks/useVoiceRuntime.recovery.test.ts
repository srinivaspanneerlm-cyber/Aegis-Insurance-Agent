/**
 * Voice session + recovery (Phase 2, Step 8).
 *
 * Everything here is composed from state the runtime already had — `turnId`,
 * `sessionId`, the live stream's own phase — plus the one genuinely new axis,
 * `lastCompletedTurn`. Nothing is a second orchestrator or a second memory:
 * `session` is a read-only view, and `RECOVERING` is a narrow addition to the
 * existing table for the failures that are not the customer's microphone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useVoiceRuntime, type VoiceRuntimeOptions } from "./useVoiceRuntime";
import type { VoiceHook, VoiceOptions } from "./useVoice";
import { SpeechToTextError } from "@/services/speechToText";

const transcribeAudio = vi.hoisted(() => vi.fn());
vi.mock("@/services/speechToText", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/speechToText")>();
  return { ...actual, transcribeAudio };
});

const stub = vi.hoisted(() => ({ options: null as unknown }));
vi.mock("./useVoice", () => ({
  useVoice: (options: unknown) => {
    stub.options = options;
    return {
      voiceState: "idle", transcript: "", error: null, isSpeaking: false,
      isListening: false, volume: 0,
      startListening: async () => {}, stopListening: () => {},
      flushRecording: () => {}, discardRecording: () => {},
      speak: () => {}, stopSpeaking: () => {}, retryAfterError: () => {},
    };
  },
}));

/** The options the runtime registered with `useVoice` — `onSpeakError` lives here. */
const registered = () => stub.options as VoiceOptions;

function makeVoice(overrides: Partial<VoiceHook> = {}): VoiceHook {
  return {
    voiceState: "idle", transcript: "", error: null, isSpeaking: false,
    isListening: false, volume: 0,
    startListening: vi.fn(async () => {}),
    stopListening: vi.fn(),
    flushRecording: vi.fn(),
    discardRecording: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    retryAfterError: vi.fn(),
    ...overrides,
  };
}

function mount(extra: Partial<VoiceRuntimeOptions> = {}) {
  const onSubmit = vi.fn();
  const voice = makeVoice(extra.voice);
  const initialProps: VoiceRuntimeOptions = { onSubmit, vad: false, ...extra, voice };
  const view = renderHook((props: VoiceRuntimeOptions) => useVoiceRuntime(props), {
    initialProps,
  });
  return { ...view, onSubmit, voice, initialProps };
}

type Runtime = ReturnType<typeof useVoiceRuntime>;

async function listen(result: { current: Runtime }) {
  await act(async () => { await result.current.startListening(); });
}

async function process(result: { current: Runtime }, text = "i need health cover for my parents") {
  await listen(result);
  act(() => { result.current.submitTurn(text); });
}

beforeEach(() => { stub.options = null; vi.clearAllMocks(); });

// ── Voice session ─────────────────────────────────────────────────────────────

describe("voice session", () => {
  it("assembles from the runtime's own state, without a second store", async () => {
    const { result } = mount({
      sessionId: "sess-1",
      agent: { name: "Sarah AI", domain: "health" },
      language: "ta-IN",
    });

    expect(result.current.session).toEqual({
      sessionId: "sess-1",
      conversationId: "sess-1",
      turnId: 0,
      // No caller offers one today — see `VoiceRuntimeOptions.userId`.
      userId: null,
      currentAgent: { name: "Sarah AI", domain: "health" },
      language: "ta-IN",
      voiceState: "IDLE",
      lastCompletedTurn: null,
      activeGenerationId: 0,
    });

    await process(result);

    // `activeGenerationId` reuses `turnId` rather than a second counter.
    expect(result.current.session.turnId).toBe(1);
    expect(result.current.session.activeGenerationId).toBe(1);
    expect(result.current.session.voiceState).toBe("PROCESSING");
  });

  it("defaults sessionId to empty rather than inventing one", () => {
    const { result } = mount();
    expect(result.current.session.sessionId).toBe("");
    expect(result.current.session.conversationId).toBe("");
  });
});

// ── Turn checkpoint ──────────────────────────────────────────────────────────

describe("turn checkpoint", () => {
  it("records the turn as complete only off the stream's own done signal", async () => {
    const { result, rerender, initialProps } = mount({
      stream: { phase: "streaming", error: null },
    });
    await process(result);
    expect(result.current.session.lastCompletedTurn).toBeNull();

    act(() => {
      rerender({ ...initialProps, stream: { phase: "done", error: null } });
    });

    expect(result.current.session.lastCompletedTurn).toBe(1);
  });

  it("never records a completion for a turn that was never spoken", () => {
    const { result, rerender, initialProps } = mount({
      stream: { phase: "streaming", error: null },
    });

    // No voice turn ever started — this is what a typed message's own `done`
    // looks like from here. It must not be mistaken for a voice checkpoint.
    act(() => {
      rerender({ ...initialProps, stream: { phase: "done", error: null } });
    });

    expect(result.current.session.lastCompletedTurn).toBeNull();
    expect(result.current.turnState).toBe("IDLE");
  });

  it("keeps the last completed turn across a later turn's recovery", async () => {
    transcribeAudio.mockResolvedValue({ transcript: "", language: null, provider: "gemini" });
    const { result, rerender, initialProps } = mount({
      transcription: "server",
      stream: { phase: "streaming", error: null },
    });
    await process(result);
    act(() => { rerender({ ...initialProps, stream: { phase: "done", error: null } }); });
    expect(result.current.session.lastCompletedTurn).toBe(1);

    // A second, unrelated failure recovering must not erase what the first
    // turn already delivered.
    act(() => {
      rerender({ ...initialProps, stream: { phase: "streaming", error: null } });
    });
    await process(result, "one more question");
    act(() => {
      rerender({ ...initialProps, stream: { phase: "error", error: "dropped" } });
    });
    expect(result.current.turnState).toBe("RECOVERING");
    expect(result.current.session.lastCompletedTurn).toBe(1);
    expect(result.current.session.sessionId).toBe(result.current.session.sessionId);
  });
});

// ── Duplicate submission & stale responses ──────────────────────────────────

describe("duplicate submission and stale responses", () => {
  it("refuses a second dispatch while the first is still in flight", async () => {
    const { result, onSubmit } = mount();
    await process(result);

    const accepted = result.current.submitTurn("a second thing entirely");

    expect(accepted).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.turnState).toBe("PROCESSING");
  });

  it("drops a streamed chunk addressed to a turn that is no longer current", async () => {
    const { result, voice } = mount({ stream: { phase: "streaming", error: null } });
    await process(result);
    const staleTurn = result.current.turnId;

    // The customer cut in — a fresh turn starts, orphaning the old one.
    act(() => { result.current.interrupt(); });
    await listen(result);
    act(() => { result.current.submitTurn("something else"); });
    expect(result.current.turnId).toBeGreaterThan(staleTurn);

    (voice.speak as ReturnType<typeof vi.fn>).mockClear();
    act(() => {
      result.current.pushStreamedText("a reply for the abandoned turn", staleTurn);
    });

    expect(voice.speak).not.toHaveBeenCalled();
  });

  it("refuses to close a turn on a stale finishStreamedTurn", async () => {
    const { result } = mount({ stream: { phase: "streaming", error: null } });
    await process(result);
    const staleTurn = result.current.turnId;
    act(() => { result.current.interrupt(); });

    let closed = true;
    act(() => {
      closed = result.current.finishStreamedTurn("late reply", staleTurn);
    });
    expect(closed).toBe(false);
  });
});

// ── Recovery ─────────────────────────────────────────────────────────────────

describe("recovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits out a dropped stream instead of requiring an acknowledgement", async () => {
    const { result, rerender, initialProps } = mount({
      sessionId: "sess-keep",
      stream: { phase: "streaming", error: null },
    });
    await process(result);

    act(() => {
      rerender({ ...initialProps, stream: { phase: "error", error: "connection dropped" } });
    });

    expect(result.current.turnState).toBe("RECOVERING");
    expect(result.current.isRecovering).toBe(true);
    expect(result.current.isBusy).toBe(false);
    // The conversation identity is untouched by a pause, only by a reset.
    expect(result.current.session.sessionId).toBe("sess-keep");

    act(() => { vi.runAllTimers(); });

    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.error).toBeNull();
  });

  it("recovers from a synthesiser failure instead of stranding the turn", async () => {
    const { result, voice } = mount({ stream: { phase: "streaming", error: null } });
    await process(result);
    act(() => { result.current.pushStreamedText("Here is what I found for you. Let me explain."); });
    expect(voice.speak).toHaveBeenCalled();

    // The synthesiser reported an error for the utterance in flight.
    act(() => { registered().onSpeakError?.(); });

    expect(result.current.turnState).toBe("RECOVERING");
    expect(result.current.error).toMatch(/reading that reply/i);

    // Nothing from the failed utterance is left queued to play once recovered.
    (voice.speak as ReturnType<typeof vi.fn>).mockClear();
    act(() => { vi.runAllTimers(); });
    expect(result.current.turnState).toBe("IDLE");
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it("recovers from a transient STT failure without touching the mic-error path", async () => {
    transcribeAudio.mockRejectedValue(new SpeechToTextError("timeout", "Transcribing took too long."));
    const { result } = mount({ transcription: "server" });
    await listen(result);
    act(() => { result.current.endTurn(); });

    // The recorder handing back a finished recording after `flushRecording()`,
    // same as `useVoice` does in server mode.
    await act(async () => {
      registered().onAudio?.(new Blob([new Uint8Array(4096)], { type: "audio/webm" }), "audio/webm");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.turnState).toBe("RECOVERING");
    act(() => { vi.runAllTimers(); });
    expect(result.current.turnState).toBe("IDLE");
  });

  it("does not retry silently forever — a second failure during the wait is a hard stop", async () => {
    const { result, rerender, initialProps } = mount({
      stream: { phase: "streaming", error: null },
    });
    await process(result);

    act(() => {
      rerender({ ...initialProps, stream: { phase: "error", error: "first drop" } });
    });
    expect(result.current.turnState).toBe("RECOVERING");

    const blocked = makeVoice({ error: "Mic blocked — allow microphone in browser settings." });
    act(() => {
      rerender({ ...initialProps, voice: blocked, stream: { phase: "error", error: "first drop" } });
    });

    expect(result.current.turnState).toBe("ERROR");
    act(() => { vi.runAllTimers(); });
    // The first failure's timer must not fire a stray recovery into the hard error.
    expect(result.current.turnState).toBe("ERROR");
  });

  it("has nothing to interrupt while recovering", async () => {
    const { result, rerender, initialProps } = mount({
      stream: { phase: "streaming", error: null },
    });
    await process(result);
    act(() => {
      rerender({ ...initialProps, stream: { phase: "error", error: "dropped" } });
    });
    expect(result.current.turnState).toBe("RECOVERING");

    const accepted = result.current.interrupt();
    expect(accepted).toBe(false);
    expect(result.current.turnState).toBe("RECOVERING");
  });
});

// ── Typed chat is unaffected ─────────────────────────────────────────────────

describe("typed chat regression", () => {
  it("never leaves IDLE for a stream the customer only typed to", () => {
    const { result, rerender, initialProps } = mount({
      stream: { phase: "idle", error: null },
    });

    for (const phase of ["thinking", "streaming", "done"] as const) {
      act(() => { rerender({ ...initialProps, stream: { phase, error: null } }); });
      expect(result.current.turnState).toBe("IDLE");
    }

    act(() => {
      rerender({ ...initialProps, stream: { phase: "error", error: "network" } });
    });
    // The error watcher is scoped to PROCESSING, exactly as before this step —
    // a typed message's failure is not this runtime's to react to.
    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.session.lastCompletedTurn).toBeNull();
  });
});
