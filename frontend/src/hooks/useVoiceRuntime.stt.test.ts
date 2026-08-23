/**
 * A spoken turn, end to end, with the server doing the transcribing.
 *
 * The thing under test is not the upload — that is `speechToText.test.ts` — it
 * is the *seam*: that a recording becomes a transcript and then enters the
 * system through the one door a typed message uses, and that every way this can
 * fail leaves the customer somewhere they can act from rather than stuck with a
 * dead microphone.
 *
 * The turn machine from Step 2 is deliberately unchanged by any of this. A
 * recording being uploaded is still `LISTENING`, because it has not reached the
 * orchestrator yet; `isTranscribing` is a separate axis, like `vadPhase`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVoiceRuntime, type VoiceRuntimeOptions } from "./useVoiceRuntime";
import type { VoiceHook, VoiceOptions } from "./useVoice";
import { SpeechToTextError } from "@/services/speechToText";

// The real error class is kept — the runtime branches on `instanceof` and on
// `kind`, and a stub would let a regression in that branching pass unnoticed.
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
      voiceState: "idle",
      transcript: "",
      error: null,
      isSpeaking: false,
      isListening: false,
      volume: 0,
      startListening: async () => {},
      stopListening: () => {},
      flushRecording: () => {},
      discardRecording: () => {},
      speak: () => {},
      stopSpeaking: () => {},
      retryAfterError: () => {},
    };
  },
}));

/** The options the runtime registered with `useVoice` — where `onAudio` lives. */
const registered = () => stub.options as VoiceOptions;

function makeVoice(overrides: Partial<VoiceHook> = {}): VoiceHook {
  return {
    voiceState: "idle",
    transcript: "",
    error: null,
    isSpeaking: false,
    isListening: false,
    volume: 0,
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
  const view = renderHook(() =>
    useVoiceRuntime({
      onSubmit,
      transcription: "server",
      // The VAD has its own suite; end-of-turn is driven explicitly here so a
      // threshold change cannot make this file flaky.
      vad: false,
      ...extra,
      voice,
    })
  );
  return { ...view, onSubmit, voice };
}

const RECORDING = () => new Blob([new Uint8Array(4096)], { type: "audio/webm" });

/** Open the mic the only way the machine allows. */
async function listen(result: { current: ReturnType<typeof useVoiceRuntime> }) {
  await act(async () => { await result.current.startListening(); });
}

/** Deliver a finished recording, as `useVoice` does after a flush. */
async function deliverAudio() {
  await act(async () => {
    registered().onAudio?.(RECORDING(), "audio/webm");
    // Let the transcription promise settle.
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  transcribeAudio.mockReset();
});

describe("server transcription — the ordinary turn", () => {
  it("never asks the browser for a recogniser", async () => {
    const { result } = mount();
    await listen(result);

    // This is the acceptance criterion for the whole step. `useVoice` is told
    // to record, and it is that flag — not a SpeechRecognition probe — that
    // decides whether Firefox, Safari and Brave can talk to an advisor.
    expect(registered().transcription).toBe("server");
    expect(typeof registered().onAudio).toBe("function");
  });

  it("sends the transcript through the caller's existing send path", async () => {
    transcribeAudio.mockResolvedValue({
      transcript: "I need cover for my parents",
      language: "en-IN",
      provider: "gemini",
    });
    const { result, onSubmit } = mount();
    await listen(result);

    act(() => { result.current.endTurn(); });
    await deliverAudio();

    // One dispatch, through `onSubmit` — the same function the textarea calls.
    // If this ever becomes a second path, a spoken turn and a typed turn stop
    // being the same conversation to the orchestrator.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("I need cover for my parents"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.turnState).toBe("PROCESSING");
  });

  it("stays LISTENING while the recording is being transcribed", async () => {
    let resolve!: (value: unknown) => void;
    transcribeAudio.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result, voice, onSubmit } = mount();
    await listen(result);

    act(() => { result.current.endTurn(); });
    expect(voice.flushRecording).toHaveBeenCalled();
    await deliverAudio();

    expect(result.current.isTranscribing).toBe(true);
    // Not PROCESSING: nothing has reached the orchestrator, and claiming it had
    // would be a lie the machine then has to unwind if transcription fails.
    expect(result.current.turnState).toBe("LISTENING");
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      resolve({ transcript: "hello", language: "en-IN", provider: "gemini" });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isTranscribing).toBe(false));
  });

  it("carries the detected language without acting on it", async () => {
    transcribeAudio.mockResolvedValue({
      transcript: "enakku family health policy venum",
      language: "ta-en",
      provider: "gemini",
    });
    const { result, onSubmit } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    await waitFor(() => expect(result.current.detectedLanguage).toBe("ta-en"));
    // Thanglish reaches the advisor exactly as spoken. Nothing translates it —
    // the existing language layer reads it the way it reads a typed message.
    expect(onSubmit).toHaveBeenCalledWith("enakku family health policy venum");
  });

  it("passes Tamil script through untouched", async () => {
    const tamil = "எனக்கு மருத்துவ காப்பீடு வேண்டும்";
    transcribeAudio.mockResolvedValue({ transcript: tamil, language: "ta-IN", provider: "gemini" });
    const { result, onSubmit } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(tamil));
  });

  it("offers the interface language to the provider as a hint", async () => {
    transcribeAudio.mockResolvedValue({ transcript: "ok", language: "ta-IN", provider: "gemini" });
    const { result } = mount({ language: "ta-IN" });
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    await waitFor(() => expect(transcribeAudio).toHaveBeenCalled());
    expect(transcribeAudio.mock.calls[0][1]).toMatchObject({ language: "ta-IN" });
  });
});

describe("server transcription — recovery", () => {
  it("lets the customer simply speak again when nothing was heard", async () => {
    transcribeAudio.mockRejectedValue(
      new SpeechToTextError("empty", "We didn't catch that. Tap the mic and speak again.")
    );
    const { result, onSubmit } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    // Silence is not a fault. The one failure that must NOT end in ERROR:
    // making someone acknowledge an error dialog because a room was noisy is
    // how a customer gives up on voice.
    await waitFor(() => expect(result.current.isTranscribing).toBe(false));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.lastRejected?.event).toBe("SUBMIT_TURN");
    expect(result.current.turnState).not.toBe("ERROR");
  });

  it("recovers on its own, with the way out, when the provider fails", async () => {
    transcribeAudio.mockRejectedValue(
      new SpeechToTextError("provider", "Voice input is unavailable right now. Please type your question instead.")
    );
    const { result, voice } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    // A provider hiccup is not the customer's mic — it clears itself rather
    // than sitting in a bare ERROR waiting for reset().
    await waitFor(() => expect(result.current.turnState).toBe("RECOVERING"));
    expect(result.current.isRecovering).toBe(true);
    expect(result.current.error).toMatch(/type your question/i);
    // The mic is closed, not left open behind an error nobody can clear.
    expect(voice.stopListening).toHaveBeenCalled();
    expect(result.current.isTranscribing).toBe(false);

    await waitFor(
      () => expect(result.current.turnState).toBe("IDLE"),
      { timeout: 2000 }
    );
    expect(result.current.error).toBeNull();
  });

  it("lets reset skip the wait and clear a recovering turn immediately", async () => {
    transcribeAudio.mockRejectedValue(new SpeechToTextError("timeout", "Transcribing took too long."));
    const { result } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();
    await waitFor(() => expect(result.current.turnState).toBe("RECOVERING"));

    act(() => { result.current.reset(); });
    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.error).toBeNull();
    expect(result.current.detectedLanguage).toBeNull();
  });

  it("reports a network failure as a network failure", async () => {
    transcribeAudio.mockRejectedValue(
      new SpeechToTextError("network", "Couldn't reach Aegis to transcribe that. Check your connection, or type your question.")
    );
    const { result } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    await waitFor(() => expect(result.current.error).toMatch(/connection/i));
  });

  it("survives a transcription that rejects with something unexpected", async () => {
    transcribeAudio.mockRejectedValue(new Error("TypeError: cannot read property of undefined"));
    const { result } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    await waitFor(() => expect(result.current.turnState).toBe("RECOVERING"));
    // Never the raw internal message.
    expect(result.current.error).toMatch(/type your question/i);
  });
});

describe("server transcription — audio that must go nowhere", () => {
  it("discards a recording that arrives after the customer cancelled", async () => {
    transcribeAudio.mockResolvedValue({ transcript: "too late", language: null, provider: "gemini" });
    const { result, onSubmit } = mount();
    await listen(result);

    act(() => { result.current.stopListening(); });
    expect(result.current.turnState).toBe("IDLE");

    await deliverAudio();
    // A cancel is a cancel: audio in flight is not turned into a turn they no
    // longer want, and it never reaches the orchestrator.
    await waitFor(() => expect(transcribeAudio).not.toHaveBeenCalled());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not dispatch a transcript that lands after an interrupt", async () => {
    let resolve!: (value: unknown) => void;
    transcribeAudio.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result, onSubmit } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    act(() => { result.current.interrupt(); });
    expect(result.current.turnState).toBe("INTERRUPTED");

    await act(async () => {
      resolve({ transcript: "they walked away", language: null, provider: "gemini" });
      await Promise.resolve();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses a second flush while one is already being transcribed", async () => {
    transcribeAudio.mockReturnValue(new Promise(() => {}));
    const { result, voice } = mount();
    await listen(result);

    act(() => { result.current.endTurn(); });
    act(() => { expect(result.current.endTurn()).toBe(false); });

    // One turn, one recording, one paid transcription.
    expect(voice.flushRecording).toHaveBeenCalledTimes(1);
    expect(result.current.lastRejected?.reason).toMatch(/already being transcribed/i);
  });

  it("aborts an upload still in flight when the page is left", async () => {
    // Production-hardening finding: `reset()` already aborts a pending
    // upload, but it is only ever called from an effect keyed on the active
    // advisor category — never on unmount. Navigating away mid-transcription
    // used to leave that request running unobserved.
    transcribeAudio.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = mount();
    await listen(result);
    act(() => { result.current.endTurn(); });
    await deliverAudio();

    expect(transcribeAudio).toHaveBeenCalled();
    const signal = transcribeAudio.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

describe("browser mode is untouched", () => {
  it("keeps endTurn as a plain stopListening when the browser transcribes", async () => {
    const { result, voice } = mount({ transcription: "browser" });
    await listen(result);

    act(() => { expect(result.current.endTurn()).toBe(true); });

    // The recogniser owns its own utterance boundaries in this mode, so there
    // is nothing buffered to flush and the old behaviour must survive exactly.
    expect(voice.stopListening).toHaveBeenCalled();
    expect(voice.flushRecording).not.toHaveBeenCalled();
    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.isTranscribing).toBe(false);
  });

  it("still auto-submits the recogniser's final transcript", async () => {
    const { result, onSubmit } = mount({ transcription: "browser" });
    await listen(result);

    act(() => { registered().onTranscript?.("I want motor insurance", true); });

    expect(onSubmit).toHaveBeenCalledWith("I want motor insurance");
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});
