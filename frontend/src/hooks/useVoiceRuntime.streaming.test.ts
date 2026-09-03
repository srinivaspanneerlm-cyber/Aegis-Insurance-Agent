/**
 * Speaking a reply while it is still being written.
 *
 * The old behaviour was one `speak(wholeReply)` at `onDone`, so everything
 * before the model's last word was dead air. Now sentences go to the
 * synthesiser as they complete — and the risks change shape entirely. They are
 * all about the seam between one utterance and the next: two speaking at once,
 * the same one twice, a queue that stalls, a turn that never closes, and a
 * typed message that suddenly starts talking.
 *
 * `useVoice.speak` cancels whatever is playing before it starts, so "no
 * overlap" is not a nicety — a second call before the first has ended cuts the
 * first sentence off mid-word.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useVoiceRuntime, type VoiceRuntimeOptions } from "./useVoiceRuntime";
import type { VoiceHook, VoiceOptions } from "./useVoice";

const stub = vi.hoisted(() => ({ options: null as unknown }));
vi.mock("./useVoice", () => ({
  useVoice: (options: unknown) => {
    stub.options = options;
    return {
      voiceState: "idle", transcript: "", error: null, isSpeaking: false,
      isListening: false, volume: 0,
      startListening: async () => {}, stopListening: () => {},
      flushRecording: () => {},
      discardRecording: () => {}, speak: () => {}, stopSpeaking: () => {},
      retryAfterError: () => {},
    };
  },
}));

/** The options the runtime registered with `useVoice` — where `onSpeakEnd` lives. */
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
  const onSpeakEnd = vi.fn();
  const voice = makeVoice(extra.voice);
  const view = renderHook(() =>
    useVoiceRuntime({ onSubmit, onSpeakEnd, vad: false, ...extra, voice })
  );
  return { ...view, onSubmit, onSpeakEnd, voice };
}

type Runtime = ReturnType<typeof useVoiceRuntime>;

/** Drive a spoken turn to PROCESSING, the only state a reply is read aloud from. */
async function speakingTurn(result: { current: Runtime }, voice: VoiceHook) {
  await act(async () => { await result.current.startListening(); });
  act(() => { result.current.submitTurn("I need health cover"); });
  expect(result.current.turnState).toBe("PROCESSING");
  (voice.speak as ReturnType<typeof vi.fn>).mockClear();
}

/** What the synthesiser was asked to say, in order. */
const spoken = (voice: VoiceHook): string[] =>
  (voice.speak as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);

/** The browser reporting that the current utterance finished. */
function utteranceEnded() {
  act(() => { registered().onSpeakEnd?.(); });
}

beforeEach(() => { stub.options = null; });

describe("speaking as the reply arrives", () => {
  it("says the first sentence before the reply has finished", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("I can help with that. Let me look"); });

    // The whole point: audio starts on the first full stop, not at `onDone`.
    expect(spoken(voice)).toEqual(["I can help with that."]);
    expect(result.current.turnState).toBe("SPEAKING");
  });

  it("holds a partial sentence back rather than stuttering it out", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("I would"); });
    act(() => { result.current.pushStreamedText("I would suggest a"); });

    expect(spoken(voice)).toEqual([]);
    expect(result.current.turnState).toBe("PROCESSING");
  });

  it("never starts a second utterance while one is playing", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => {
      result.current.pushStreamedText("One sentence here. Two sentence here. Three here. ");
    });

    // Three are ready; exactly one is speaking. `speak` cancels whatever is
    // playing, so a second call now would cut the first off mid-word.
    expect(spoken(voice)).toEqual(["One sentence here."]);

    utteranceEnded();
    expect(spoken(voice)).toEqual(["One sentence here.", "Two sentence here."]);

    utteranceEnded();
    expect(spoken(voice)).toEqual([
      "One sentence here.", "Two sentence here.", "Three here.",
    ]);
  });

  it("holds the last sentence until the stream closes", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    // The terminator is the final character, so the next token could still
    // reveal it was "₹3.5" all along. Spoken once the stream is shut, not
    // guessed at while it is open.
    act(() => { result.current.pushStreamedText("First one. Second one."); });
    expect(spoken(voice)).toEqual(["First one."]);

    act(() => { result.current.finishStreamedTurn(); });
    utteranceEnded();
    expect(spoken(voice)).toEqual(["First one.", "Second one."]);
  });

  it("never says the same sentence twice as the accumulator grows", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    // The stream sends the whole reply each time, not the delta — so a naive
    // implementation re-speaks everything on every token.
    act(() => { result.current.pushStreamedText("First one. "); });
    act(() => { result.current.pushStreamedText("First one. Second one. "); });
    act(() => { result.current.pushStreamedText("First one. Second one. Third one. "); });

    utteranceEnded();
    utteranceEnded();
    utteranceEnded();

    expect(spoken(voice)).toEqual(["First one.", "Second one.", "Third one."]);
  });

  it("waits in SPEAKING through the gap between two sentences", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("Only one so far. "); });
    utteranceEnded();

    // Nothing queued, but the model is still writing. Closing the turn here
    // would end the reply half-way through it.
    expect(result.current.turnState).toBe("SPEAKING");

    act(() => { result.current.pushStreamedText("Only one so far. And now another. "); });
    expect(spoken(voice)).toEqual(["Only one so far.", "And now another."]);
  });

  it("records when audio actually began", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);
    expect(result.current.firstAudioAt).toBeNull();

    act(() => { result.current.pushStreamedText("Here we go. "); });
    expect(typeof result.current.firstAudioAt).toBe("number");
  });
});

describe("closing the turn", () => {
  it("speaks the tail and returns to IDLE once the queue drains", async () => {
    const { result, voice, onSpeakEnd } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("A first sentence. And a trailing one"); });
    act(() => { expect(result.current.finishStreamedTurn()).toBe(true); });

    utteranceEnded();
    // A closing fragment with no terminator is still worth saying.
    expect(spoken(voice)).toEqual(["A first sentence.", "And a trailing one"]);
    expect(result.current.turnState).toBe("SPEAKING");

    utteranceEnded();
    expect(result.current.turnState).toBe("IDLE");
    expect(onSpeakEnd).toHaveBeenCalled();
  });

  it("reports that there was nothing worth saying, rather than stranding the turn", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    // A reply that is nothing but a plan card: the customer sees it, and there
    // is no audio to wait for. Left unreported, the turn sits in PROCESSING and
    // the microphone stays locked out behind it.
    act(() => { result.current.pushStreamedText('[RECOMMENDATION:{"type":"single_plan"}]'); });
    act(() => { expect(result.current.finishStreamedTurn()).toBe(false); });

    expect(spoken(voice)).toEqual([]);
    expect(result.current.turnState).toBe("PROCESSING");
  });

  it("takes the final text as authoritative over the last token seen", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("Half of it. "); });
    act(() => { result.current.finishStreamedTurn("Half of it. And the rest of it."); });

    utteranceEnded();
    expect(spoken(voice)).toEqual(["Half of it.", "And the rest of it."]);
  });

  it("never reads a recommendation card out loud", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => {
      result.current.finishStreamedTurn(
        'Here is my suggestion.\n\n[RECOMMENDATION:{"type":"single_plan","premium":650}]'
      );
    });

    expect(spoken(voice)).toEqual(["Here is my suggestion."]);
    expect(spoken(voice).join(" ")).not.toContain("RECOMMENDATION");
  });
});

describe("when the turn is retracted", () => {
  it("drops what was queued and speaks the correction instead", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => {
      result.current.pushStreamedText("Our Supreme plan costs. Another claim here. ");
    });
    expect(spoken(voice)).toEqual(["Our Supreme plan costs."]);

    act(() => {
      result.current.replaceStreamedText("I hit a technical problem just then.");
    });
    // A `replace` is always followed by `done`, which is what flushes the tail.
    act(() => { result.current.finishStreamedTurn(); });

    // The queued second sentence belonged to a reply this turn no longer makes,
    // and is never spoken.
    expect(voice.stopSpeaking).toHaveBeenCalled();
    expect(spoken(voice)).toEqual([
      "Our Supreme plan costs.",
      "I hit a technical problem just then.",
    ]);
    expect(spoken(voice)).not.toContain("Another claim here.");
  });

  it("still closes cleanly after a retraction", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("Retracted sentence. "); });
    act(() => { result.current.replaceStreamedText("The real answer."); });
    act(() => { result.current.finishStreamedTurn("The real answer."); });

    utteranceEnded();
    expect(result.current.turnState).toBe("IDLE");
  });
});

describe("interruption and cleanup", () => {
  it("stops talking when the customer interrupts", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("One. Two. Three. Four. "); });
    act(() => { result.current.interrupt(); });

    expect(result.current.turnState).toBe("INTERRUPTED");
    utteranceEnded();
    // Anything still queued belongs to a turn they walked away from.
    expect(spoken(voice)).toEqual(["One."]);
  });

  it("does not carry one turn's sentences into the next", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);

    act(() => { result.current.pushStreamedText("Old answer one. Old answer two. "); });
    act(() => { result.current.reset(); });

    await speakingTurn(result, voice);
    act(() => { result.current.pushStreamedText("A brand new answer. "); });

    expect(spoken(voice)).toEqual(["A brand new answer."]);
  });

  it("ignores streamed text once the turn has been reset", async () => {
    const { result, voice } = mount();
    await speakingTurn(result, voice);
    act(() => { result.current.reset(); });

    act(() => { result.current.pushStreamedText("Nobody asked for this. "); });
    expect(spoken(voice)).toEqual([]);
  });
});

describe("typed chat is untouched", () => {
  it("says nothing at all when the runtime is IDLE", () => {
    // The regression that matters most: every token of a typed conversation
    // reaches `pushStreamedText`, and a typed conversation must stay silent.
    const { result, voice } = mount();
    expect(result.current.turnState).toBe("IDLE");

    act(() => { result.current.pushStreamedText("A full sentence typed by the customer. "); });
    act(() => { expect(result.current.finishStreamedTurn("A full sentence.")).toBe(false); });

    expect(spoken(voice)).toEqual([]);
    expect(result.current.turnState).toBe("IDLE");
  });

  it("leaves the replay button working as a single utterance", async () => {
    const { result, voice, onSpeakEnd } = mount();

    act(() => { expect(result.current.startSpeaking("The whole reply, replayed.")).toBe(true); });
    expect(spoken(voice)).toEqual(["The whole reply, replayed."]);
    expect(result.current.turnState).toBe("SPEAKING");

    // One utterance, one end event, back to IDLE — exactly as before the queue
    // existed. A replay must not wait on a stream that was never open.
    utteranceEnded();
    expect(result.current.turnState).toBe("IDLE");
    expect(onSpeakEnd).toHaveBeenCalled();
  });

  it("still refuses to speak an empty reply", () => {
    const { result, voice } = mount();
    act(() => { expect(result.current.startSpeaking("   ")).toBe(false); });
    expect(spoken(voice)).toEqual([]);
  });
});
