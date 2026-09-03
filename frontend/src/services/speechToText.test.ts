/**
 * The transcription client, and specifically its failures.
 *
 * A voice turn fails silently by nature — there is nothing on screen to read —
 * so every failure has to arrive as a sentence the customer can act on, and the
 * two that need *opposite* actions must never be confused: "we didn't catch
 * that, speak again" and "voice is down, type instead". That distinction is
 * what most of this file is about.
 */
import { describe, it, expect, vi } from "vitest";
import { SpeechToTextError, transcribeAudio } from "./speechToText";
import { MIN_RECORDING_BYTES } from "@/lib/audioCapture";

const API = "http://api.test/api";

/** A recording of `size` bytes that claims `type`. */
function recording(size = MIN_RECORDING_BYTES + 500, type = "audio/webm;codecs=opus"): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

/** A `fetch` that answers once with this status and body. */
function responding(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const ok = (data: Record<string, unknown>) => responding(200, { status: "success", data });

async function failure(promise: Promise<unknown>): Promise<SpeechToTextError> {
  try {
    await promise;
  } catch (err) {
    return err as SpeechToTextError;
  }
  throw new Error("expected the transcription to fail, but it resolved");
}

describe("transcribeAudio — the happy path", () => {
  it("returns what was said, with the language carried alongside", async () => {
    const fetchImpl = ok({ transcript: "I need health cover for my parents", language: "en-IN", provider: "gemini" });
    const result = await transcribeAudio(recording(), { fetchImpl, apiUrl: API });

    expect(result.transcript).toBe("I need health cover for my parents");
    expect(result.language).toBe("en-IN");
    expect(result.provider).toBe("gemini");
  });

  it("posts multipart to the backend, with the session cookie", async () => {
    const fetchImpl = ok({ transcript: "hello", language: null, provider: "gemini" });
    await transcribeAudio(recording(), { fetchImpl, apiUrl: API, language: "ta-IN" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/voice/transcribe`);
    expect(init.method).toBe("POST");
    // The JWT is an httpOnly cookie — it cannot be attached by hand.
    expect(init.credentials).toBe("include");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("language")).toBe("ta-IN");
    // Setting Content-Type by hand omits the multipart boundary and makes the
    // body unparseable at the other end. The browser must add it.
    expect((init.headers as Record<string, string>) ?? {}).not.toHaveProperty("Content-Type");
  });

  it("carries a Tamil transcript back in Tamil script, untouched", async () => {
    const tamil = "எனக்கு மருத்துவ காப்பீடு வேண்டும்";
    const fetchImpl = ok({ transcript: tamil, language: "ta-IN", provider: "gemini" });
    const result = await transcribeAudio(recording(), { fetchImpl, apiUrl: API });

    // Nothing here may transliterate or translate: the advisor's own language
    // layer reads the transcript exactly as it reads a typed message.
    expect(result.transcript).toBe(tamil);
    expect(result.language).toBe("ta-IN");
  });

  it("keeps Thanglish in Latin script rather than 'correcting' it", async () => {
    const thanglish = "enakku family ku oru health policy venum, premium evlo aagum?";
    const fetchImpl = ok({ transcript: thanglish, language: "ta-en", provider: "gemini" });
    const result = await transcribeAudio(recording(), { fetchImpl, apiUrl: API });

    expect(result.transcript).toBe(thanglish);
    expect(result.language).toBe("ta-en");
  });
});

describe("transcribeAudio — nothing was heard", () => {
  it("refuses a recording too short to hold speech, without a request", async () => {
    const fetchImpl = ok({ transcript: "should never be reached" });
    const err = await failure(transcribeAudio(recording(200), { fetchImpl, apiUrl: API }));

    expect(err.kind).toBe("empty");
    // The point of checking locally: an empty turn never costs a provider call.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("treats an empty transcript as 'speak again', not as a breakage", async () => {
    const fetchImpl = ok({ transcript: "   ", language: null, provider: "gemini" });
    const err = await failure(transcribeAudio(recording(), { fetchImpl, apiUrl: API }));

    expect(err.kind).toBe("empty");
    expect(err.userMessage).toMatch(/didn't catch that/i);
  });
});

describe("transcribeAudio — failures the customer must be able to act on", () => {
  it("says the session ended on a 401, rather than blaming the mic", async () => {
    const err = await failure(
      transcribeAudio(recording(), { fetchImpl: responding(401, {}), apiUrl: API })
    );
    expect(err.kind).toBe("unauthorized");
    expect(err.userMessage).toMatch(/sign in/i);
  });

  it("distinguishes an unsupported format from a broken service", async () => {
    const err = await failure(
      transcribeAudio(recording(), { fetchImpl: responding(415, {}), apiUrl: API })
    );
    expect(err.kind).toBe("unsupported");
    expect(err.userMessage).toMatch(/type your question/i);
  });

  it("names rate limiting as something to wait out", async () => {
    const err = await failure(
      transcribeAudio(recording(), { fetchImpl: responding(429, {}), apiUrl: API })
    );
    expect(err.kind).toBe("rate-limited");
    expect(err.userMessage).toMatch(/wait a moment/i);
  });

  it("prefers the server's own sentence when it wrote one", async () => {
    const fetchImpl = responding(503, { message: "Voice input is unavailable right now. Please type your question instead." });
    const err = await failure(transcribeAudio(recording(), { fetchImpl, apiUrl: API }));
    expect(err.userMessage).toBe("Voice input is unavailable right now. Please type your question instead.");
  });

  it("still says something useful when a gateway answers with HTML", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const err = await failure(transcribeAudio(recording(), { fetchImpl, apiUrl: API }));

    expect(err.kind).toBe("provider");
    expect(err.userMessage).toMatch(/type your question/i);
  });

  it("reports a dropped connection as a connection problem", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const err = await failure(transcribeAudio(recording(), { fetchImpl, apiUrl: API }));

    expect(err.kind).toBe("network");
    expect(err.userMessage).toMatch(/connection/i);
  });

  it("survives a success envelope that changed shape", async () => {
    // Payload drift between the browser and the backend has broken this repo
    // before. It must surface as a clear voice error, never as `undefined`
    // travelling on to the orchestrator.
    const fetchImpl = responding(200, { status: "success", data: { text: "wrong key" } });
    const err = await failure(transcribeAudio(recording(), { fetchImpl, apiUrl: API }));
    expect(err.kind).toBe("empty");
  });

  it("survives a 200 whose body is not JSON at all", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const err = await failure(transcribeAudio(recording(), { fetchImpl, apiUrl: API }));
    expect(err.kind).toBe("provider");
  });

  it("abandons the upload when the caller aborts", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      throw abortError;
    });

    const err = await failure(
      transcribeAudio(recording(), { fetchImpl, apiUrl: API, signal: controller.signal })
    );
    expect(err.kind).toBe("timeout");
  });
});
