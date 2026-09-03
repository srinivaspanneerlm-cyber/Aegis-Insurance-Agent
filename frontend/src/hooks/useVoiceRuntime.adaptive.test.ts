/**
 * Adapting how the advisor speaks, without adapting what it says.
 *
 * Two things are under test and they pull in opposite directions. One is that
 * the voice layer notices something — that a turn was worded briskly, that a
 * reply handed the conversation back — and delivers accordingly. The other is
 * that noticing changes nothing a customer relies on: same session, same send
 * path, same silence on a typed message.
 *
 * The turn-taking tests are the ones with teeth. A microphone that reopens by
 * itself is the difference between a conversation and a series of button
 * presses, and it is also the thing that, done carelessly, sits open in an
 * empty room.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVoiceRuntime, type VoiceRuntimeOptions } from "./useVoiceRuntime";
import type { VoiceHook, VoiceOptions } from "./useVoice";

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
      flushRecording: () => {},
      discardRecording: () => {}, speak: () => {}, stopSpeaking: () => {},
      retryAfterError: () => {},
    };
  },
}));

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
  const view = renderHook(() =>
    useVoiceRuntime({
      onSubmit, transcription: "server", vad: false, ...extra, voice,
    })
  );
  return { ...view, onSubmit, voice };
}

type Runtime = ReturnType<typeof useVoiceRuntime>;

const spoken = (voice: VoiceHook): string[] =>
  (voice.speak as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);

/** Speak one turn, all the way to PROCESSING, through the real transcription seam. */
async function speakTurn(
  result: { current: Runtime },
  voice: VoiceHook,
  said: string,
  language: string | null = "en-IN"
) {
  transcribeAudio.mockResolvedValue({ transcript: said, language, provider: "gemini" });
  await act(async () => { await result.current.startListening(); });
  act(() => { result.current.endTurn(); });
  await act(async () => {
    registered().onAudio?.(new Blob([new Uint8Array(4096)], { type: "audio/webm" }), "audio/webm");
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.turnState).toBe("PROCESSING"));
  (voice.speak as ReturnType<typeof vi.fn>).mockClear();
}

const utteranceEnded = () => act(() => { registered().onSpeakEnd?.(); });

beforeEach(() => { transcribeAudio.mockReset(); stub.options = null; });

describe("the context a spoken turn carries", () => {
  it("is assembled from what already exists, and only when something is spoken", async () => {
    const { result, voice } = mount({
      agent: { name: "Sarah AI", domain: "health", conversationState: "Data Collection", intent: "general" },
    });
    // Nothing spoken yet.
    expect(result.current.voiceContext).toBeNull();
    expect(result.current.speakingStyle).toBe("normal");

    await speakTurn(result, voice, "I already told you my age twice");

    const context = result.current.voiceContext;
    expect(context).not.toBeNull();
    expect(context!.style).toBe("frustrated");
    expect(context!.transcript).toBe("I already told you my age twice");
    // Read from the live stream, not invented here: there is one state machine
    // and it is the middleware's.
    expect(context!.agentName).toBe("Sarah AI");
    expect(context!.conversationState).toBe("Data Collection");
  });

  it("carries the language the transcription heard, as metadata", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "enakku family policy venum", "ta-en");
    // Carried so it can be shown. Aegis still answers in English unless the
    // customer asks in words — speaking Tamil is not asking for Tamil.
    expect(result.current.voiceContext!.language).toBe("ta-en");
  });

  it("holds one style for the whole turn rather than flickering per token", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "I need this urgently");
    expect(result.current.speakingStyle).toBe("urgent");

    act(() => { result.current.pushStreamedText("Of course. I can help. "); });
    // The reply's own wording must not restyle the turn — that would be audible.
    expect(result.current.speakingStyle).toBe("urgent");
  });

  it("clears on reset", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "Yes go ahead");
    expect(result.current.speakingStyle).toBe("brief");

    act(() => { result.current.reset(); });
    expect(result.current.voiceContext).toBeNull();
    expect(result.current.speakingStyle).toBe("normal");
  });
});

describe("handing the conversation back", () => {
  it("reopens the microphone after the advisor asks a question", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "I need health cover");

    act(() => { result.current.finishStreamedTurn("And how many people are we covering?"); });
    utteranceEnded();

    // A human advisor who asks something stops talking and waits. Asking the
    // customer to reach for a button between every answer is the friction
    // voice was supposed to remove.
    await waitFor(() => expect(result.current.turnState).toBe("LISTENING"));
    expect(voice.startListening).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the advisor made a statement", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "I need health cover");

    act(() => { result.current.finishStreamedTurn("That plan covers your whole family."); });
    utteranceEnded();

    await waitFor(() => expect(result.current.turnState).toBe("IDLE"));
    expect(voice.startListening).toHaveBeenCalledTimes(1);
  });

  it("gives up after two openings that heard nothing", async () => {
    // A microphone that reopens after every question would otherwise sit open
    // for as long as the tab does, once the customer has walked away.
    const { result, voice } = mount();
    await speakTurn(result, voice, "I need health cover");

    transcribeAudio.mockRejectedValue(
      Object.assign(new Error("empty"), { kind: "empty", userMessage: "We didn't catch that." })
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => { result.current.finishStreamedTurn("Anything else you would like to add?"); });
      utteranceEnded();
      await act(async () => { await Promise.resolve(); });
      if (result.current.turnState !== "LISTENING") break;
      act(() => { result.current.endTurn(); });
      await act(async () => {
        registered().onAudio?.(new Blob([], { type: "audio/webm" }), "audio/webm");
        await Promise.resolve();
      });
    }

    await waitFor(() => expect(result.current.turnState).not.toBe("LISTENING"));
  });

  it("never opens a microphone for a typed conversation", async () => {
    // The regression that matters most: a typed turn leaves the runtime IDLE,
    // so nothing here can reach a microphone.
    const { result, voice } = mount();
    act(() => { result.current.finishStreamedTurn("And how old are you?"); });
    utteranceEnded();

    await act(async () => { await Promise.resolve(); });
    expect(result.current.turnState).toBe("IDLE");
    expect(voice.startListening).not.toHaveBeenCalled();
  });

  it("can be switched off entirely", async () => {
    const { result, voice } = mount({ handsFree: false });
    await speakTurn(result, voice, "I need health cover");

    act(() => { result.current.finishStreamedTurn("How many people are we covering?"); });
    utteranceEnded();

    await act(async () => { await Promise.resolve(); });
    expect(result.current.turnState).toBe("IDLE");
    expect(voice.startListening).toHaveBeenCalledTimes(1);
  });
});

describe("cutting in", () => {
  it("stops the advisor and starts listening", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "Tell me about health cover");

    act(() => { result.current.pushStreamedText("A family floater covers everyone. It also "); });
    expect(result.current.turnState).toBe("SPEAKING");

    await act(async () => { await result.current.interruptAndListen(); });

    // Silenced *before* the microphone opens, never alongside it — the
    // half-duplex invariant the turn table has protected since Step 2.
    expect(voice.stopSpeaking).toHaveBeenCalled();
    expect(result.current.turnState).toBe("LISTENING");
  });

  it("drops everything the advisor had queued to say", async () => {
    const { result, voice } = mount();
    await speakTurn(result, voice, "Tell me about health cover");

    act(() => { result.current.pushStreamedText("First point. Second point. Third point. "); });
    expect(spoken(voice)).toEqual(["First point."]);

    await act(async () => { await result.current.interruptAndListen(); });
    utteranceEnded();

    // Queued sentences belonged to an answer the customer has moved past.
    expect(spoken(voice)).toEqual(["First point."]);
  });

  it("refuses when there is nothing to interrupt", async () => {
    const { result } = mount();
    let accepted = true;
    await act(async () => { accepted = await result.current.interruptAndListen(); });
    expect(accepted).toBe(false);
    expect(result.current.lastRejected?.event).toBe("INTERRUPT");
  });

  it("adds no new move to the turn machine", async () => {
    // Composed from INTERRUPT and START_LISTENING, both of which the table
    // already allowed. Barge-in from the customer's audio is still not built.
    const { result, voice } = mount();
    await speakTurn(result, voice, "Tell me about health cover");
    act(() => { result.current.pushStreamedText("Talking now. "); });

    await act(async () => { await result.current.interruptAndListen(); });
    expect(result.current.can("START_LISTENING")).toBe(false); // already listening
    expect(result.current.turnState).toBe("LISTENING");
  });
});

describe("continuity", () => {
  it("sends a spoken turn through the same one send path", async () => {
    const { result, voice, onSubmit } = mount();
    await speakTurn(result, voice, "I need health cover for my parents");

    // Same `onSubmit` the textarea calls — one session, one conversation, one
    // set of memory. There is no parallel voice store to diverge from it.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("I need health cover for my parents");
  });

  it("passes the transcript through untouched, whatever the style", async () => {
    const { result, voice, onSubmit } = mount();
    // Adaptation is about the reply's wording. It must never edit what the
    // customer actually said on its way to the orchestrator.
    await speakTurn(result, voice, "I ALREADY TOLD YOU, I need it urgently!!");
    expect(onSubmit).toHaveBeenCalledWith("I ALREADY TOLD YOU, I need it urgently!!");
    expect(result.current.speakingStyle).toBe("frustrated");
  });
});
