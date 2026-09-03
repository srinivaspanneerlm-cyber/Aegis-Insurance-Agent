/**
 * Cutting the advisor off, and everything that must not survive it.
 *
 * Barge-in is the first thing in this voice layer where the dangerous failure
 * is *silence being broken*, not silence itself. A reply the customer has
 * walked away from must not finish its sentence, must not resume two seconds
 * later when a queued chunk arrives, and must not close a turn that has since
 * been replaced. So most of what follows is about the things that are still in
 * flight at the moment of the interruption: an utterance at the speaker, a
 * transcription on the network, a token about to be parsed.
 *
 * The other half is restraint. The microphone is open beside an active
 * loudspeaker for the whole reply, and a detector that fires on the echo would
 * cut the advisor off mid-sentence on every single turn — which is worse than
 * having no barge-in at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useVoiceRuntime, type VoiceRuntimeOptions } from "./useVoiceRuntime";
import type { VoiceHook, VoiceOptions } from "./useVoice";
import { BARGE_IN_VAD_CONFIG, VAD_SAMPLE_MS } from "@/lib/vad";

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

const registered = () => stub.options as VoiceOptions;

/** A fake microphone whose level the test drives directly. */
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

type Runtime = ReturnType<typeof useVoiceRuntime>;

function mount(extra: Partial<VoiceRuntimeOptions> = {}) {
  const onSubmit = vi.fn();
  const onCancelResponse = vi.fn();
  const onBargeIn = vi.fn();
  let volume = 0;
  const voice = makeVoice({ ...extra.voice });

  const view = renderHook((props: { volume: number }) =>
    useVoiceRuntime({
      onSubmit, onCancelResponse, onBargeIn,
      transcription: "server",
      ...extra,
      voice: { ...voice, volume: props.volume },
    }),
    { initialProps: { volume } }
  );

  const setVolume = (level: number) => {
    volume = level;
    view.rerender({ volume });
  };
  return { ...view, onSubmit, onCancelResponse, onBargeIn, voice, setVolume };
}

const spoken = (voice: VoiceHook): string[] =>
  (voice.speak as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);

const RECORDING = () => new Blob([new Uint8Array(4096)], { type: "audio/webm" });

/**
 * Let every pending promise settle.
 *
 * The clock is faked here so the detector can be driven one sample at a time,
 * which means anything that polls on a timer would poll forever. The work being
 * waited on is microtask work anyway: a transcription that has already
 * resolved, and the state update behind it.
 */
async function flush(times = 4) {
  await act(async () => {
    for (let i = 0; i < times; i += 1) await Promise.resolve();
  });
}

/** Drive a spoken turn to PROCESSING through the real transcription seam. */
async function speakTurn(result: { current: Runtime }, said = "Tell me about health cover") {
  transcribeAudio.mockResolvedValue({ transcript: said, language: "en-IN", provider: "gemini" });
  await act(async () => { await result.current.startListening(); });
  act(() => { result.current.endTurn(); });
  await act(async () => {
    registered().onAudio?.(RECORDING(), "audio/webm");
    await Promise.resolve();
    await Promise.resolve();
  });
  await flush();
  expect(result.current.turnState).toBe("PROCESSING");
}

/** Hold the level above the barge-in bar long enough for the detector to believe it. */
async function speakOver(setVolume: (v: number) => void, ms = 900) {
  setVolume(BARGE_IN_VAD_CONFIG.startThreshold + 0.2);
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

/** Hold a level that should never be mistaken for the customer. */
async function makeNoise(setVolume: (v: number) => void, level: number, ms = 900) {
  setVolume(level);
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  transcribeAudio.mockReset();
  stub.options = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cutting in while the advisor is speaking", () => {
  it("stops mid-sentence and gives the customer the floor", async () => {
    const { result, voice, setVolume, onBargeIn } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("A family floater covers everyone. It also "); });
    expect(result.current.turnState).toBe("SPEAKING");

    await speakOver(setVolume);

    expect(voice.stopSpeaking).toHaveBeenCalled();
    expect(result.current.turnState).toBe("LISTENING");
    expect(result.current.wasInterrupted).toBe(true);
    expect(onBargeIn).toHaveBeenCalled();
  });

  it("abandons the reply without touching the conversation", async () => {
    const { result, setVolume, onCancelResponse } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Talking now. "); });

    await speakOver(setVolume);

    // Only the presentation is cancelled. The orchestrator's turn finishes
    // server-side, so the session, the agent and the memory it wrote survive.
    expect(onCancelResponse).toHaveBeenCalledTimes(1);
  });

  it("does not close the microphone it is already recording with", async () => {
    // The customer's first word — usually the one carrying the interruption —
    // is in the buffer before the detector is sure enough to act. Reopening
    // the microphone would throw it away.
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Talking now. "); });
    (voice.startListening as ReturnType<typeof vi.fn>).mockClear();

    await speakOver(setVolume);

    expect(result.current.turnState).toBe("LISTENING");
    expect(voice.startListening).not.toHaveBeenCalled();
    expect(voice.stopListening).not.toHaveBeenCalled();
  });

  it("drops every sentence the advisor had left to say", async () => {
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("First point. Second point. Third point. "); });
    expect(spoken(voice)).toEqual(["First point."]);

    await speakOver(setVolume);
    act(() => { registered().onSpeakEnd?.(); });

    // Queued sentences belong to an answer the customer has moved past.
    expect(spoken(voice)).toEqual(["First point."]);
  });

  it("also works while the advisor is still thinking", async () => {
    const { result, setVolume, onCancelResponse } = mount();
    await speakTurn(result);
    expect(result.current.turnState).toBe("PROCESSING");

    await speakOver(setVolume);

    expect(result.current.turnState).toBe("LISTENING");
    expect(onCancelResponse).toHaveBeenCalled();
  });
});

describe("restraint", () => {
  it("is not fooled by the advisor's own voice leaking back", async () => {
    // The microphone is open beside the loudspeaker for the whole reply. Echo
    // cancellation leaves residue, and firing on it would cut the advisor off
    // mid-sentence on every single turn — worse than no barge-in at all.
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("A long explanation continues here. "); });

    await makeNoise(setVolume, BARGE_IN_VAD_CONFIG.startThreshold - 0.05, 2000);

    expect(result.current.turnState).toBe("SPEAKING");
    expect(voice.stopSpeaking).not.toHaveBeenCalled();
  });

  it("is not fooled by a cough", async () => {
    const { result, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Still explaining. "); });

    // Loud, but over before the debounce is satisfied.
    setVolume(0.9);
    await act(async () => { await vi.advanceTimersByTimeAsync(VAD_SAMPLE_MS * 2); });
    setVolume(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(result.current.turnState).toBe("SPEAKING");
  });

  it("can be switched off entirely", async () => {
    const { result, setVolume, onCancelResponse } = mount({ bargeIn: false });
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Talking now. "); });

    await speakOver(setVolume, 3000);

    expect(result.current.turnState).toBe("SPEAKING");
    expect(onCancelResponse).not.toHaveBeenCalled();
  });
});

describe("stale work", () => {
  it("ignores tokens from the reply that was cut off", async () => {
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    const staleTurn = result.current.turnId;
    act(() => { result.current.pushStreamedText("Being said. ", staleTurn); });

    await speakOver(setVolume);
    (voice.speak as ReturnType<typeof vi.fn>).mockClear();

    // The old stream is still decoding when the customer starts talking.
    act(() => { result.current.pushStreamedText("Being said. And more of it. ", staleTurn); });
    expect(spoken(voice)).toEqual([]);
  });

  it("ignores the cut-off reply's completion", async () => {
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    const staleTurn = result.current.turnId;
    act(() => { result.current.pushStreamedText("Being said. ", staleTurn); });

    await speakOver(setVolume);
    (voice.speak as ReturnType<typeof vi.fn>).mockClear();

    let closed = true;
    act(() => { closed = result.current.finishStreamedTurn("The whole reply.", staleTurn); });

    // It must not speak, and it must not drag the new turn back to IDLE.
    expect(closed).toBe(false);
    expect(spoken(voice)).toEqual([]);
    expect(result.current.turnState).toBe("LISTENING");
  });

  it("ignores a retraction aimed at the cut-off reply", async () => {
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    const staleTurn = result.current.turnId;
    await speakOver(setVolume);
    (voice.speak as ReturnType<typeof vi.fn>).mockClear();

    act(() => { result.current.replaceStreamedText("A late correction.", staleTurn); });
    expect(spoken(voice)).toEqual([]);
  });

  it("gives every turn its own number, always moving forward", async () => {
    const { result, setVolume } = mount();
    const start = result.current.turnId;

    await speakTurn(result);
    const first = result.current.turnId;
    expect(first).toBeGreaterThan(start);

    await speakOver(setVolume);
    expect(result.current.turnId).toBeGreaterThan(first);
  });

  it("still accepts work that names the live turn", async () => {
    const { result, voice } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("This one is current. ", result.current.turnId); });
    expect(spoken(voice)).toEqual(["This one is current."]);
  });

  it("accepts work that names no turn at all", async () => {
    // Backward compatible: a caller that never learned about turn ids — the
    // replay button, an older test — behaves exactly as it did.
    const { result, voice } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("No id given. "); });
    expect(spoken(voice)).toEqual(["No id given."]);
  });
});

describe("what happens next", () => {
  it("continues the same conversation rather than starting one", async () => {
    const { result, onSubmit, setVolume } = mount();
    await speakTurn(result, "Tell me about health cover");
    act(() => { result.current.pushStreamedText("A family floater covers "); });

    await speakOver(setVolume);
    setVolume(0);

    // The customer says the thing they cut in to say.
    transcribeAudio.mockResolvedValue({
      transcript: "Actually, what about my parents?", language: "en-IN", provider: "gemini",
    });
    act(() => { result.current.endTurn(); });
    await act(async () => {
      registered().onAudio?.(RECORDING(), "audio/webm");
      await Promise.resolve();
      await Promise.resolve();
    });

    // Same send path, same session, same agent — one conversation with an
    // interruption in it, not two conversations.
    await flush();
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("Actually, what about my parents?");
  });

  it("treats a bare 'wait' as a request for silence, not a question", async () => {
    const { result, onSubmit, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Explaining at length. "); });
    await speakOver(setVolume);
    setVolume(0);

    transcribeAudio.mockResolvedValue({ transcript: "Wait.", language: "en-IN", provider: "gemini" });
    act(() => { result.current.endTurn(); });
    await act(async () => {
      registered().onAudio?.(RECORDING(), "audio/webm");
      await Promise.resolve();
      await Promise.resolve();
    });

    // Sending it would spend a paid call to have the advisor say "of course,
    // go ahead" over the top of them. The microphone just stays open.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await flush();
    expect(result.current.turnState).toBe("LISTENING");
  });

  it("survives being interrupted over and over", async () => {
    const { result, setVolume, onCancelResponse } = mount();

    for (let round = 0; round < 3; round += 1) {
      await speakTurn(result, `Question number ${round}`);
      act(() => { result.current.pushStreamedText("Beginning to answer. "); });
      await speakOver(setVolume);
      expect(result.current.turnState).toBe("LISTENING");
      setVolume(0);
      act(() => { result.current.stopListening(); });
    }

    expect(onCancelResponse).toHaveBeenCalledTimes(3);
    expect(result.current.turnId).toBeGreaterThanOrEqual(6);
  });
});

describe("when cancellation fails", () => {
  it("still orphans the turn if the synthesiser refuses to stop", async () => {
    const voice = makeVoice({
      stopSpeaking: vi.fn(() => { throw new Error("speechSynthesis is wedged"); }),
    });
    const { result, setVolume } = mount({ voice });
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Refusing to stop. Second sentence. "); });
    const staleTurn = result.current.turnId;

    await speakOver(setVolume);

    // The floor still changes hands, and nothing further can be spoken for the
    // dead turn — which is what actually protects the customer.
    expect(result.current.turnState).toBe("LISTENING");
    expect(result.current.turnId).toBeGreaterThan(staleTurn);
    act(() => { result.current.pushStreamedText("More stale text. ", staleTurn); });
    expect(spoken(voice)).toEqual(["Refusing to stop."]);
  });

  it("still gives the customer the floor if the caller cannot cancel", async () => {
    const { result, setVolume } = mount({
      onCancelResponse: () => { throw new Error("no abort controller"); },
    });
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Talking. "); });

    await speakOver(setVolume);
    expect(result.current.turnState).toBe("LISTENING");
  });
});

describe("typed chat is untouched", () => {
  it("never monitors when the runtime is idle", async () => {
    const { result, voice, setVolume } = mount();
    expect(result.current.turnState).toBe("IDLE");

    await makeNoise(setVolume, 0.9, 3000);

    expect(result.current.turnState).toBe("IDLE");
    expect(voice.stopSpeaking).not.toHaveBeenCalled();
  });

  it("never monitors in browser transcription mode", async () => {
    // The browser recogniser cannot listen beside an active speaker, so
    // barge-in is server-transcription only and this stays exactly as it was.
    const { result, voice, setVolume } = mount({ transcription: "browser" });
    act(() => { result.current.startSpeaking("Reading a reply aloud."); });
    expect(result.current.turnState).toBe("SPEAKING");

    await makeNoise(setVolume, 0.9, 3000);

    expect(result.current.turnState).toBe("SPEAKING");
    expect(voice.stopSpeaking).not.toHaveBeenCalled();
  });
});

describe("the monitoring buffer", () => {
  it("is recycled while nobody is speaking", async () => {
    // The microphone records for the whole reply so an interruption's opening
    // words are already captured. A minute-long reply must not leave a minute
    // of audio behind it, or send all of it for transcription.
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("A very long explanation. "); });
    (voice.discardRecording as ReturnType<typeof vi.fn>).mockClear();

    await makeNoise(setVolume, 0.01, 9000);

    expect((voice.discardRecording as ReturnType<typeof vi.fn>).mock.calls.length)
      .toBeGreaterThanOrEqual(2);
  });

  it("is never recycled mid-interruption", async () => {
    // Recycling while the customer is speaking would clip the very words the
    // open microphone exists to capture.
    const { result, voice, setVolume } = mount();
    await speakTurn(result);
    act(() => { result.current.pushStreamedText("Explaining. "); });
    (voice.discardRecording as ReturnType<typeof vi.fn>).mockClear();

    await speakOver(setVolume, 6000);

    expect(voice.discardRecording).not.toHaveBeenCalled();
    expect(result.current.turnState).toBe("LISTENING");
  });
});
