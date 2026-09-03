/**
 * What a voice turn is allowed to do.
 *
 * The machine matters more than the microphone here. Every refusal in the table
 * stands for something that goes wrong in a real conversation — a second turn
 * dispatched while the first is still reaching the orchestrator, a reply read
 * aloud over an open mic, a turn stuck in `PROCESSING` after the stream died —
 * and none of those are visible on screen when the customer is only listening.
 * So the guards are tested directly, not inferred from a rendered component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  useVoiceRuntime,
  canVoiceTurn,
  nextVoiceTurnState,
  VOICE_TURN_EVENTS,
  VOICE_TURN_STATES,
  VOICE_TURN_TRANSITIONS,
  type VoiceRuntimeOptions,
  type VoiceTurnEvent,
  type VoiceTurnState,
} from "./useVoiceRuntime";
import type { VoiceHook, VoiceOptions } from "./useVoice";

// Every test drives the runtime through an injected fake voice. The real hook
// is stubbed as well so the callbacks the runtime registers with it — the ones
// the browser fires when speech ends — can be invoked directly, since jsdom has
// no speech synthesis to fire them.
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

/** The options the runtime registered with the real `useVoice`. */
const registered = () => stub.options as VoiceOptions;

// ── Fakes ─────────────────────────────────────────────────────────────────────

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
  const initialProps: VoiceRuntimeOptions = { onSubmit, ...extra, voice };
  const view = renderHook((props: VoiceRuntimeOptions) => useVoiceRuntime(props), {
    initialProps,
  });
  return { ...view, onSubmit, voice, initialProps };
}

/** Drive the runtime to `LISTENING` the only way it can legally get there. */
async function listen(result: { current: ReturnType<typeof useVoiceRuntime> }) {
  await act(async () => {
    await result.current.startListening();
  });
}

/** …and on to `PROCESSING`, by submitting a turn. */
async function process(result: { current: ReturnType<typeof useVoiceRuntime> }) {
  await listen(result);
  act(() => {
    result.current.submitTurn("i need health cover for my parents");
  });
}

/** …and on to `SPEAKING`, by reading a reply out. */
async function speakReply(result: { current: ReturnType<typeof useVoiceRuntime> }) {
  await process(result);
  act(() => {
    result.current.startSpeaking("Here are three plans that fit your budget.");
  });
}

// ── The transition table, on its own ─────────────────────────────────────────

describe("voice turn transition table", () => {
  it("starts a conversation from IDLE and nowhere else", () => {
    expect(canVoiceTurn("IDLE", "START_LISTENING")).toBe(true);
    expect(canVoiceTurn("INTERRUPTED", "START_LISTENING")).toBe(true);
    // A customer who was told the mic is blocked must acknowledge it first.
    expect(canVoiceTurn("ERROR", "START_LISTENING")).toBe(false);
  });

  it("refuses a second dispatch while one turn is with the orchestrator", () => {
    // This is the guard that keeps turn N+1 out of a session whose turn N has
    // not landed in SessionManager or MemoryOrchestrator yet.
    expect(canVoiceTurn("PROCESSING", "SUBMIT_TURN")).toBe(false);
    expect(canVoiceTurn("PROCESSING", "START_LISTENING")).toBe(false);
  });

  it("never speaks over an open microphone", () => {
    expect(canVoiceTurn("LISTENING", "START_SPEAKING")).toBe(false);
  });

  it("does not allow barge-in yet", () => {
    // Reopening the mic mid-reply needs a half-duplex lock that is not built.
    // When it is, this is the single line that changes.
    expect(canVoiceTurn("SPEAKING", "START_LISTENING")).toBe(false);
  });

  it("refuses to send a turn that was never spoken", () => {
    expect(canVoiceTurn("IDLE", "SUBMIT_TURN")).toBe(false);
  });

  it("lets a customer out of every state", () => {
    for (const state of VOICE_TURN_STATES) {
      expect(nextVoiceTurnState(state, "RESET")).toBe("IDLE");
    }
  });

  it("can fail from anywhere except an existing failure", () => {
    for (const state of VOICE_TURN_STATES) {
      const expected = state === "ERROR" ? null : "ERROR";
      expect(nextVoiceTurnState(state, "FAIL")).toBe(expected);
    }
  });

  it("returns null for every pair the table does not name", () => {
    for (const state of VOICE_TURN_STATES) {
      for (const event of VOICE_TURN_EVENTS) {
        const declared = VOICE_TURN_TRANSITIONS[state][event];
        expect(nextVoiceTurnState(state, event)).toBe(declared ?? null);
      }
    }
  });

  it("only ever lands on a real state", () => {
    for (const state of VOICE_TURN_STATES) {
      for (const to of Object.values(VOICE_TURN_TRANSITIONS[state])) {
        expect(VOICE_TURN_STATES).toContain(to);
      }
    }
  });
});

// ── The runtime ───────────────────────────────────────────────────────────────

describe("useVoiceRuntime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts idle, silent and unarmed", () => {
    const { result, voice, onSubmit } = mount();
    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.transcript).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.lastRejected).toBeNull();
    // Mounting must not touch the microphone or the send path.
    expect(voice.startListening).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("opens the microphone on the way to LISTENING", async () => {
    const { result, voice } = mount();
    await listen(result);
    expect(result.current.turnState).toBe("LISTENING");
    expect(result.current.isListening).toBe(true);
    expect(voice.startListening).toHaveBeenCalledTimes(1);
  });

  it("closes the microphone again without sending anything", async () => {
    const { result, voice, onSubmit } = mount();
    await listen(result);
    act(() => {
      expect(result.current.stopListening()).toBe(true);
    });
    expect(result.current.turnState).toBe("IDLE");
    expect(voice.stopListening).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hands a submitted turn to the caller's send path, once", async () => {
    const { result, onSubmit, voice } = mount();
    await process(result);
    expect(result.current.turnState).toBe("PROCESSING");
    expect(result.current.isBusy).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("i need health cover for my parents");
    // The mic closes before the dispatch, not after.
    expect(voice.stopListening).toHaveBeenCalled();
  });

  it("sends what the recogniser heard when given no text", async () => {
    const { result, onSubmit } = mount({
      voice: makeVoice({ transcript: "  health insurance for my parents  " }),
    });
    await listen(result);
    act(() => {
      result.current.submitTurn();
    });
    expect(onSubmit).toHaveBeenCalledWith("health insurance for my parents");
  });

  it("refuses a turn with nothing in it", async () => {
    const { result, onSubmit } = mount();
    await listen(result);
    act(() => {
      expect(result.current.submitTurn("   ")).toBe(false);
    });
    expect(result.current.turnState).toBe("LISTENING");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.lastRejected?.reason).toMatch(/nothing was heard/i);
  });

  it("reads the reply aloud from PROCESSING", async () => {
    const { result, voice } = mount();
    await speakReply(result);
    expect(result.current.turnState).toBe("SPEAKING");
    expect(result.current.isSpeaking).toBe(true);
    expect(voice.speak).toHaveBeenCalledWith("Here are three plans that fit your budget.");
  });

  it("will not read an empty reply aloud", async () => {
    const { result, voice } = mount();
    await process(result);
    act(() => {
      expect(result.current.startSpeaking("")).toBe(false);
    });
    expect(result.current.turnState).toBe("PROCESSING");
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it("ends the turn when the reply finishes", async () => {
    const { result } = mount();
    await speakReply(result);
    act(() => {
      expect(result.current.stopSpeaking()).toBe(true);
    });
    expect(result.current.turnState).toBe("IDLE");
  });

  it("stops the audio when the customer interrupts a reply", async () => {
    const { result, voice } = mount();
    await speakReply(result);
    act(() => {
      expect(result.current.interrupt()).toBe(true);
    });
    expect(result.current.turnState).toBe("INTERRUPTED");
    expect(voice.stopSpeaking).toHaveBeenCalled();
  });

  it("lets an interrupted customer speak again without a reset", async () => {
    const { result, voice } = mount();
    await speakReply(result);
    act(() => {
      result.current.interrupt();
    });
    await listen(result);
    expect(result.current.turnState).toBe("LISTENING");
    expect(voice.startListening).toHaveBeenCalledTimes(2);
  });

  it("can be interrupted mid-dispatch too", async () => {
    const { result } = mount();
    await process(result);
    act(() => {
      expect(result.current.interrupt()).toBe(true);
    });
    expect(result.current.turnState).toBe("INTERRUPTED");
  });

  it("fails the turn when the microphone reports an error", async () => {
    const { result, rerender, initialProps } = mount();
    await listen(result);

    const blocked = makeVoice({
      error: "Mic blocked — allow microphone in browser settings.",
      voiceState: "error",
    });
    act(() => {
      rerender({ ...initialProps, voice: blocked });
    });

    expect(result.current.turnState).toBe("ERROR");
    expect(result.current.error).toMatch(/mic blocked/i);
  });

  it("does not strand a turn in PROCESSING when the stream dies — and recovers on its own", async () => {
    vi.useFakeTimers();
    try {
      const { result, rerender, initialProps } = mount({
        stream: { phase: "streaming", error: null },
      });
      await process(result);

      act(() => {
        rerender({
          ...initialProps,
          stream: { phase: "error", error: "Please sign in to continue this conversation." },
        });
      });

      // A dropped stream is not the customer's mic — it clears itself rather
      // than sitting in a bare ERROR waiting for reset().
      expect(result.current.turnState).toBe("RECOVERING");
      expect(result.current.isRecovering).toBe(true);
      expect(result.current.error).toMatch(/sign in/i);

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.turnState).toBe("IDLE");
      expect(result.current.isRecovering).toBe(false);
      expect(result.current.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up and hard-fails when a second failure lands during recovery", async () => {
    vi.useFakeTimers();
    try {
      const { result, rerender, initialProps } = mount({
        stream: { phase: "streaming", error: null },
      });
      await process(result);

      act(() => {
        rerender({ ...initialProps, stream: { phase: "error", error: "network blip" } });
      });
      expect(result.current.turnState).toBe("RECOVERING");

      const blocked = makeVoice({ error: "Mic blocked.", voiceState: "error" });
      act(() => {
        rerender({ ...initialProps, voice: blocked, stream: { phase: "error", error: "network blip" } });
      });

      expect(result.current.turnState).toBe("ERROR");

      // The recovery timer from the first failure must not fire a stray
      // RECOVERY_DONE into the hard error that replaced it.
      act(() => {
        vi.runAllTimers();
      });
      expect(result.current.turnState).toBe("ERROR");
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers only through reset", async () => {
    const { result, rerender, initialProps, voice } = mount();
    const blocked = makeVoice({ error: "Microphone not found or in use by another app." });
    act(() => {
      rerender({ ...initialProps, voice: blocked });
    });
    expect(result.current.turnState).toBe("ERROR");

    // The mic stays shut until the customer acknowledges the fault.
    await act(async () => {
      expect(await result.current.startListening()).toBe(false);
    });
    expect(result.current.turnState).toBe("ERROR");
    expect(blocked.startListening).not.toHaveBeenCalled();

    act(() => {
      rerender({ ...initialProps, voice });
      result.current.reset();
    });
    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.error).toBeNull();
    expect(result.current.lastRejected).toBeNull();

    await listen(result);
    expect(result.current.turnState).toBe("LISTENING");
  });

  it("returns to idle from any state", async () => {
    const cases: Array<[VoiceTurnState, (r: { current: ReturnType<typeof useVoiceRuntime> }) => Promise<void>]> = [
      ["LISTENING", listen],
      ["PROCESSING", process],
      ["SPEAKING", speakReply],
    ];
    for (const [expected, drive] of cases) {
      const { result } = mount();
      await drive(result);
      expect(result.current.turnState).toBe(expected);
      act(() => result.current.reset());
      expect(result.current.turnState).toBe("IDLE");
    }
  });
});

describe("useVoiceRuntime wiring into the advisor page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replays a past reply from idle without starting a turn", () => {
    // The 🔊 button on an old message. No mic is open, so nothing is talked
    // over, and no turn is dispatched.
    const { result, voice, onSubmit } = mount();
    act(() => {
      expect(result.current.startSpeaking("Your policy renews in March.")).toBe(true);
    });
    expect(result.current.turnState).toBe("SPEAKING");
    expect(voice.speak).toHaveBeenCalledWith("Your policy renews in March.");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(voice.startListening).not.toHaveBeenCalled();
  });

  it("passes the hardware state through for the permission spinner", () => {
    const { result } = mount({ voice: makeVoice({ voiceState: "requesting" }) });
    // The turn machine has no "requesting" — the browser permission prompt is
    // hardware, but the UI still needs to show a spinner through it.
    expect(result.current.turnState).toBe("IDLE");
    expect(result.current.hardwareState).toBe("requesting");
  });

  it("tells the page when a reply has finished playing", async () => {
    const onSpeakEnd = vi.fn();
    const { result } = mount({ onSpeakEnd });
    await speakReply(result);

    act(() => registered().onSpeakEnd?.());

    expect(result.current.turnState).toBe("IDLE");
    expect(onSpeakEnd).toHaveBeenCalledTimes(1);
  });

  it("ignores a speech-end that arrives after the customer interrupted", async () => {
    const onSpeakEnd = vi.fn();
    const { result } = mount({ onSpeakEnd });
    await speakReply(result);
    act(() => {
      result.current.interrupt();
    });

    act(() => registered().onSpeakEnd?.());

    // The turn was ended by the customer; a late browser callback must not drag
    // it back through STOP_SPEAKING or tell the page a reply completed.
    expect(result.current.turnState).toBe("INTERRUPTED");
    expect(onSpeakEnd).not.toHaveBeenCalled();
  });
});

// ── Refusals, with the side effect that must not have happened ───────────────

describe("useVoiceRuntime refuses invalid moves", () => {
  beforeEach(() => vi.clearAllMocks());

  it("will not send a turn from IDLE", () => {
    const { result, onSubmit } = mount();
    act(() => {
      expect(result.current.submitTurn("motor insurance please")).toBe(false);
    });
    expect(result.current.turnState).toBe("IDLE");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.lastRejected).toEqual({
      from: "IDLE",
      event: "SUBMIT_TURN",
      reason: expect.stringContaining("no turn ready"),
    });
  });

  it("will not open the microphone twice", async () => {
    const { result, voice } = mount();
    await listen(result);
    await act(async () => {
      expect(await result.current.startListening()).toBe(false);
    });
    expect(voice.startListening).toHaveBeenCalledTimes(1);
    expect(result.current.turnState).toBe("LISTENING");
  });

  it("will not speak while the microphone is open", async () => {
    const { result, voice } = mount();
    await listen(result);
    act(() => {
      expect(result.current.startSpeaking("Three plans match your budget.")).toBe(false);
    });
    expect(voice.speak).not.toHaveBeenCalled();
    expect(result.current.turnState).toBe("LISTENING");
  });

  it("will not dispatch a second turn while one is in flight", async () => {
    const { result, onSubmit, voice } = mount();
    await process(result);

    act(() => {
      expect(result.current.submitTurn("actually, motor insurance")).toBe(false);
    });
    await act(async () => {
      expect(await result.current.startListening()).toBe(false);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(voice.startListening).toHaveBeenCalledTimes(1);
    expect(result.current.turnState).toBe("PROCESSING");
  });

  it("will not reopen the microphone during a reply", async () => {
    const { result, voice, onSubmit } = mount();
    await speakReply(result);
    await act(async () => {
      expect(await result.current.startListening()).toBe(false);
    });
    act(() => {
      expect(result.current.submitTurn("wait, go back")).toBe(false);
    });
    expect(voice.startListening).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.turnState).toBe("SPEAKING");
  });

  it("reports what each control may do right now", async () => {
    const { result } = mount();
    const allowed = (r: ReturnType<typeof useVoiceRuntime>) =>
      VOICE_TURN_EVENTS.filter((e: VoiceTurnEvent) => r.can(e));

    expect(allowed(result.current)).toEqual([
      "START_LISTENING",
      "START_SPEAKING",
      "RESET",
      "FAIL",
    ]);
    await listen(result);
    expect(allowed(result.current)).toEqual([
      "STOP_LISTENING",
      "SUBMIT_TURN",
      "INTERRUPT",
      "RESET",
      "FAIL",
    ]);
  });

  it("clears the last refusal once something is accepted", async () => {
    const { result } = mount();
    act(() => {
      result.current.submitTurn("too early");
    });
    expect(result.current.lastRejected).not.toBeNull();
    await listen(result);
    expect(result.current.lastRejected).toBeNull();
  });

  it("tells the caller about every refusal", async () => {
    const onRejectedTransition = vi.fn();
    const { result } = mount({ onRejectedTransition });
    act(() => {
      result.current.submitTurn("too early");
    });
    expect(onRejectedTransition).toHaveBeenCalledWith(
      expect.objectContaining({ from: "IDLE", event: "SUBMIT_TURN" })
    );
  });
});

// ── End-of-turn detection ────────────────────────────────────────────────────

describe("useVoiceRuntime end-of-turn detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const QUIET = 0.02;
  const SPEECH = 0.35;

  /** Hold the microphone at `volume` for `ms`, re-rendering so the level lands. */
  function room(
    view: ReturnType<typeof mount>,
    volume: number,
    ms: number,
    voiceOverrides: Partial<VoiceHook> = {}
  ) {
    // Committed before the clock moves, in a separate act. Sharing one act lets
    // React batch the render past the timers, so every sample would read the
    // *previous* level and each transition would land one call late.
    act(() => {
      view.rerender({
        ...view.initialProps,
        voice: { ...view.voice, volume, ...voiceOverrides },
      });
    });
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  async function openMic(view: ReturnType<typeof mount>) {
    await act(async () => {
      await view.result.current.startListening();
    });
  }

  it("hears nothing in a quiet room, however long it waits", async () => {
    const view = mount({ voice: makeVoice({ transcript: "" }) });
    await openMic(view);
    room(view, QUIET, 10_000);
    expect(view.result.current.turnState).toBe("LISTENING");
    expect(view.result.current.vadPhase).toBe("LISTENING");
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it("notices the customer start talking", async () => {
    const view = mount({ voice: makeVoice({ transcript: "i need" }) });
    await openMic(view);
    room(view, SPEECH, 400);
    expect(view.result.current.vadPhase).toBe("SPEAKING");
    // Still their turn — nothing is sent while they are mid-sentence.
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it("submits the turn once the room has been quiet long enough", async () => {
    const said = "i need health insurance for my family";
    const view = mount({ voice: makeVoice({ transcript: said }) });
    await openMic(view);

    room(view, SPEECH, 1500);
    expect(view.result.current.vadPhase).toBe("SPEAKING");

    room(view, QUIET, 600);
    expect(view.result.current.vadPhase).toBe("SILENCE");
    expect(view.onSubmit).not.toHaveBeenCalled();   // silence has not held yet

    room(view, QUIET, 900);
    expect(view.onSubmit).toHaveBeenCalledTimes(1);
    expect(view.onSubmit).toHaveBeenCalledWith(said);
    expect(view.result.current.turnState).toBe("PROCESSING");
  });

  it("does not cut a customer off when they pause to think", async () => {
    const view = mount({ voice: makeVoice({ transcript: "my parents are" }) });
    await openMic(view);
    room(view, SPEECH, 1000);
    room(view, QUIET, 800);          // a real pause, under the timeout
    room(view, SPEECH, 800);         // …and they carry on
    expect(view.result.current.vadPhase).toBe("SPEAKING");
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it("throws away a noise burst instead of sending it", async () => {
    const view = mount({ voice: makeVoice({ transcript: "" }) });
    await openMic(view);
    room(view, SPEECH, 200);         // a door, not a sentence
    room(view, QUIET, 2000);
    expect(view.onSubmit).not.toHaveBeenCalled();
    expect(view.result.current.turnState).toBe("LISTENING");
    expect(view.result.current.vadPhase).toBe("LISTENING");
  });

  it("does not hammer the send path when a loud turn produced no words", async () => {
    // Loud enough and long enough to be a turn, but the recogniser heard
    // nothing. SUBMITTING is terminal, so without re-arming this would ask
    // again on every sample for as long as the mic stayed open.
    const view = mount({ voice: makeVoice({ transcript: "   " }) });
    await openMic(view);
    room(view, SPEECH, 1500);
    room(view, QUIET, 3000);
    expect(view.onSubmit).not.toHaveBeenCalled();
    expect(view.result.current.turnState).toBe("LISTENING");
    expect(view.result.current.vadPhase).toBe("LISTENING");
  });

  it("keeps the recogniser open so the browser cannot end the turn first", async () => {
    const view = mount();
    await openMic(view);
    expect(registered().continuous).toBe(true);

    // The browser marking an utterance final must not submit — that decision is
    // the detector's, and this is the whole point of the step.
    act(() => registered().onTranscript?.("half a sentence", true));
    expect(view.onSubmit).not.toHaveBeenCalled();
    expect(view.result.current.turnState).toBe("LISTENING");
  });

  it("hands the decision back to the browser when switched off", async () => {
    const view = mount({ vad: false, voice: makeVoice({ transcript: "typed path" }) });
    await openMic(view);
    expect(registered().continuous).toBe(false);

    // Silence alone now ends nothing…
    room(view, QUIET, 5000);
    expect(view.result.current.vadPhase).toBe("IDLE");
    expect(view.onSubmit).not.toHaveBeenCalled();

    // …the recogniser's own endpointing does, exactly as before.
    act(() => registered().onTranscript?.("i need motor insurance", true));
    expect(view.onSubmit).toHaveBeenCalledWith("i need motor insurance");
  });

  it("respects caller thresholds", async () => {
    const view = mount({
      vad: { silenceTimeoutMs: 300, minSpeechMs: 100 },
      voice: makeVoice({ transcript: "quick answer" }),
    });
    await openMic(view);
    room(view, SPEECH, 400);
    room(view, QUIET, 400);
    expect(view.onSubmit).toHaveBeenCalledWith("quick answer");
  });

  it("stops listening to the room the moment the mic closes", async () => {
    const view = mount({ voice: makeVoice({ transcript: "something" }) });
    await openMic(view);
    room(view, SPEECH, 1000);
    expect(view.result.current.vadPhase).toBe("SPEAKING");

    act(() => {
      view.result.current.stopListening();
    });
    expect(view.result.current.vadPhase).toBe("IDLE");

    // A noisy room after the mic is shut must not resurrect the turn.
    room(view, SPEECH, 5000);
    expect(view.onSubmit).not.toHaveBeenCalled();
    expect(view.result.current.turnState).toBe("IDLE");
  });

  it("forgets a half-finished turn on reset, and starts clean afterwards", async () => {
    const view = mount({ voice: makeVoice({ transcript: "abandoned" }) });
    await openMic(view);
    room(view, SPEECH, 1000);

    act(() => view.result.current.reset());
    expect(view.result.current.vadPhase).toBe("IDLE");

    // The speech already banked must not count towards the next turn.
    await openMic(view);
    room(view, SPEECH, 200);
    room(view, QUIET, 2000);
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it("is not listening to the room while the advisor is answering", async () => {
    const view = mount({ voice: makeVoice({ transcript: "first turn" }) });
    await openMic(view);
    room(view, SPEECH, 1500);
    room(view, QUIET, 1400);
    expect(view.result.current.turnState).toBe("PROCESSING");
    expect(view.result.current.vadPhase).toBe("IDLE");

    // Noise during the dispatch must not queue a second turn.
    room(view, SPEECH, 5000);
    expect(view.onSubmit).toHaveBeenCalledTimes(1);
  });
});
