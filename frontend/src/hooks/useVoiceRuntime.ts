"use client";

/**
 * Aegis AI — Voice Runtime (Phase 2, Step 2: foundation only)
 *
 * One place that knows what a voice *turn* is currently doing.
 *
 * Today the spoken path has no turn concept at all: `useVoice` tracks the
 * browser's microphone and speaker, `useStreaming` tracks the SSE request, and
 * nothing joins them. So nothing can answer "is this customer mid-turn?" — and
 * without that answer the mic can be reopened while a reply is still being
 * dispatched, which would submit turn N+1 into a session whose turn N has not
 * landed in `SessionManager` or `MemoryOrchestrator` yet. The transcript is on
 * screen when that happens in text, so it reads as a glitch; in voice there is
 * nothing on screen and it reads as the advisor losing the thread.
 *
 * This runtime is that missing turn state and nothing else. It is deliberately
 * a *wrapper*:
 *
 *   - It owns no transport. The SSE path (browser → Node `/api/chat/stream` →
 *     FastAPI `/chat/stream` → `CentralOrchestrator.dispatch`) is untouched,
 *     and this file contains no `fetch`.
 *   - It owns no send path. `submitTurn` calls back into the caller's existing
 *     `sendToAdvisor`, the same function the typed composer and the current
 *     `VoiceEngine` already use. There is exactly one way into the orchestrator
 *     and this is not a second one.
 *   - It owns no session or memory. Turns ride the existing `aegis_session_id`,
 *     so a spoken turn and a typed turn are the same conversation to
 *     `SessionManager`, `ConversationMiddleware` and `MemoryOrchestrator`.
 *
 * Not in this step, on purpose: VAD, multilingual STT, streaming LLM, TTS
 * redesign, barge-in. The state machine leaves room for them — `INTERRUPTED`
 * exists and `SPEAKING → LISTENING` is deliberately *not* a legal move yet,
 * because barge-in needs a half-duplex lock that has not been built.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVoice, type VoiceHook, type VoiceState } from "./useVoice";
import type { StreamState } from "./useStreaming";
import {
  VAD_SAMPLE_MS,
  armVad,
  idleVadState,
  resolveVadConfig,
  stepVad,
  type VadConfig,
  type VadPhase,
  type VadState,
} from "@/lib/vad";

// ── Turn states ───────────────────────────────────────────────────────────────

/**
 * Where a voice turn stands.
 *
 * Distinct from `useVoice`'s `VoiceState`, which describes the browser's
 * microphone and speaker hardware. This describes the *conversation*: the mic
 * being closed says nothing about whether the advisor is still answering.
 *
 * `IDLE`        — no turn in progress; the mic is closed and nothing is playing.
 * `LISTENING`   — mic open, collecting what the customer is saying.
 * `PROCESSING`  — the turn has been handed to the existing send path and the
 *                 orchestrator is working. Nothing may be submitted from here.
 * `SPEAKING`    — the reply is being read aloud.
 * `INTERRUPTED` — the customer stopped the turn themselves. A deliberate resting
 *                 state, not an error: the next thing they do is usually speak
 *                 again, so `LISTENING` is reachable from here without a reset.
 * `ERROR`       — the mic, the browser or the stream failed. Only `reset()`
 *                 leaves, which mirrors `useVoice.retryAfterError`: a customer
 *                 who was told the mic is blocked should not silently find
 *                 themselves recording again.
 */
export type VoiceTurnState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "ERROR";

/**
 * What can happen to a turn. Seven of these are the public controls; `FAIL` is
 * raised internally when `useVoice` reports a microphone error or the observed
 * stream ends in one.
 */
export type VoiceTurnEvent =
  | "START_LISTENING"
  | "STOP_LISTENING"
  | "SUBMIT_TURN"
  | "START_SPEAKING"
  | "STOP_SPEAKING"
  | "INTERRUPT"
  | "RESET"
  | "FAIL";

export const VOICE_TURN_STATES: readonly VoiceTurnState[] = [
  "IDLE",
  "LISTENING",
  "PROCESSING",
  "SPEAKING",
  "INTERRUPTED",
  "ERROR",
] as const;

export const VOICE_TURN_EVENTS: readonly VoiceTurnEvent[] = [
  "START_LISTENING",
  "STOP_LISTENING",
  "SUBMIT_TURN",
  "START_SPEAKING",
  "STOP_SPEAKING",
  "INTERRUPT",
  "RESET",
  "FAIL",
] as const;

type TransitionTable = Readonly<
  Record<VoiceTurnState, Readonly<Partial<Record<VoiceTurnEvent, VoiceTurnState>>>>
>;

/**
 * Every legal move. Anything absent is refused — and refused *before* the side
 * effect runs, which is the whole point of the table. The moves left out matter
 * as much as the ones in it:
 *
 *   PROCESSING + START_LISTENING  the turn already in flight has not reached
 *                                 the orchestrator's session state yet.
 *   PROCESSING + SUBMIT_TURN      one turn, one dispatch, one paid LLM call.
 *   LISTENING  + START_SPEAKING   never talk over an open microphone.
 *   SPEAKING   + START_LISTENING  this is barge-in, and barge-in is Step 3.
 *   IDLE       + SUBMIT_TURN      nothing was said; there is no turn to send.
 *   ERROR      + START_LISTENING  the customer has to acknowledge the fault.
 */
export const VOICE_TURN_TRANSITIONS: TransitionTable = {
  IDLE: {
    START_LISTENING: "LISTENING",
    // Replaying a reply the customer already has on screen is not a turn — it
    // is the 🔊 button on an old message. Legal here because `IDLE` means the
    // mic is shut, which is the invariant `LISTENING + START_SPEAKING` protects.
    START_SPEAKING: "SPEAKING",
    RESET: "IDLE",
    FAIL: "ERROR",
  },
  LISTENING: {
    STOP_LISTENING: "IDLE",
    SUBMIT_TURN: "PROCESSING",
    INTERRUPT: "INTERRUPTED",
    RESET: "IDLE",
    FAIL: "ERROR",
  },
  PROCESSING: {
    START_SPEAKING: "SPEAKING",
    INTERRUPT: "INTERRUPTED",
    RESET: "IDLE",
    FAIL: "ERROR",
  },
  SPEAKING: {
    STOP_SPEAKING: "IDLE",
    INTERRUPT: "INTERRUPTED",
    RESET: "IDLE",
    FAIL: "ERROR",
  },
  INTERRUPTED: {
    START_LISTENING: "LISTENING",
    RESET: "IDLE",
    FAIL: "ERROR",
  },
  ERROR: {
    RESET: "IDLE",
  },
};

/** Where `event` leads from `from`, or `null` if it is not a legal move. */
export function nextVoiceTurnState(
  from: VoiceTurnState,
  event: VoiceTurnEvent
): VoiceTurnState | null {
  return VOICE_TURN_TRANSITIONS[from][event] ?? null;
}

/** Whether `event` is legal in `from`. Safe to call for enabling UI. */
export function canVoiceTurn(from: VoiceTurnState, event: VoiceTurnEvent): boolean {
  return nextVoiceTurnState(from, event) !== null;
}

/** A move that was refused, kept so a caller can explain or log the refusal. */
export interface RejectedTransition {
  from: VoiceTurnState;
  event: VoiceTurnEvent;
  /** Why it was refused, in a sentence a log reader can act on. */
  reason: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface VoiceRuntimeOptions {
  /**
   * The caller's existing send path — `sendToAdvisor` on the advisor page. The
   * runtime never fetches; this is the single door into the orchestrator and
   * the runtime only knocks on it.
   */
  onSubmit: (text: string) => void | Promise<void>;
  /**
   * The caller's live `useStreaming().state`, observed only. The runtime does
   * not start, cancel or parse the stream — it watches the phase so a failed
   * dispatch does not leave a turn stuck in `PROCESSING` forever.
   */
  stream?: Pick<StreamState, "phase" | "error">;
  /** Recognition and speech locale. Matches the current `VoiceEngine` default. */
  language?: string;
  /** Speech rate. Matches the current `VoiceEngine` default. */
  rate?: number;
  /**
   * Submit as soon as the recogniser marks a transcript final.
   *
   * Ignored while the VAD is running: letting the browser's endpointer submit
   * too would end the turn at whichever moment it chose, which is the behaviour
   * the VAD exists to replace.
   */
  autoSubmit?: boolean;
  /**
   * End-of-turn detection from the microphone level. `false` hands the decision
   * back to the browser's endpointer; an object overrides individual thresholds.
   */
  vad?: Partial<VadConfig> | false;
  /** Fired once a reply has finished being read out. */
  onSpeakEnd?: () => void;
  /** Told about every refused move, for diagnostics. */
  onRejectedTransition?: (rejected: RejectedTransition) => void;
  /**
   * Test seam: supply a `useVoice`-shaped object to drive the runtime without a
   * real microphone. Production callers omit it and get the real hook.
   */
  voice?: VoiceHook;
}

export interface VoiceRuntime {
  /** Where the turn stands. The runtime's own state, not the hardware's. */
  turnState: VoiceTurnState;
  /**
   * What the browser's microphone and speaker are doing, straight from
   * `useVoice`. Surfaced because the turn machine has no equivalent of
   * `requesting` — the pause while the browser asks for microphone permission
   * is hardware, not conversation, but the UI still has to show a spinner
   * through it.
   */
  hardwareState: VoiceState;
  /** What the recogniser has heard so far this turn. */
  transcript: string;
  /** Microphone, browser or stream failure, in the customer's words. */
  error: string | null;
  /** Live input level, 0–1. Drives the waveform and, now, end-of-turn detection. */
  volume: number;
  /**
   * What the voice-activity detector currently hears. `SPEAKING` here means the
   * **customer** is talking — not the advisor, which is `turnState`.
   * Always `IDLE` when the VAD is switched off.
   */
  vadPhase: VadPhase;
  isListening: boolean;
  isSpeaking: boolean;
  /** A turn is with the orchestrator and must not be disturbed. */
  isBusy: boolean;
  /** The last refused move, cleared by the next accepted one. */
  lastRejected: RejectedTransition | null;
  /** Whether a move would be accepted right now — for enabling controls. */
  can: (event: VoiceTurnEvent) => boolean;

  /** Open the mic. Resolves `false` if the move was refused. */
  startListening: () => Promise<boolean>;
  /** Close the mic without sending anything. */
  stopListening: () => boolean;
  /** Hand this turn to the caller's send path. Defaults to the live transcript. */
  submitTurn: (text?: string) => boolean;
  /** Read a reply aloud. */
  startSpeaking: (text: string) => boolean;
  /** Stop reading and end the turn. */
  stopSpeaking: () => boolean;
  /** The customer stopped the turn. Halts local audio; the stream is the caller's. */
  interrupt: () => boolean;
  /** Return to `IDLE` from anywhere, clearing the transcript and any error. */
  reset: () => void;
}

const REFUSAL_REASON: Readonly<Record<VoiceTurnEvent, string>> = {
  START_LISTENING: "the microphone cannot be opened in this state",
  STOP_LISTENING: "the microphone is not open",
  SUBMIT_TURN: "there is no turn ready to send",
  START_SPEAKING: "nothing may be spoken in this state",
  STOP_SPEAKING: "nothing is being spoken",
  INTERRUPT: "there is no turn to interrupt",
  RESET: "the runtime is already idle",
  FAIL: "the runtime has already failed",
};

export function useVoiceRuntime(options: VoiceRuntimeOptions): VoiceRuntime {
  const {
    onSubmit,
    stream,
    language = "en-IN",
    rate = 0.93,
    autoSubmit = true,
    vad,
    onSpeakEnd,
    onRejectedTransition,
    voice: injectedVoice,
  } = options;

  const [turnState, setTurnState] = useState<VoiceTurnState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [lastRejected, setLastRejected] = useState<RejectedTransition | null>(null);

  // The machine is read synchronously inside the controls, so a guard and the
  // side effect it guards cannot be separated by a render. Reading `turnState`
  // instead would let two controls fired in the same tick both see the stale
  // value and both act — which is exactly the double-dispatch this exists to
  // stop.
  const stateRef = useRef<VoiceTurnState>("IDLE");

  // Kept in refs so the controls stay referentially stable for callers that
  // memoise them, while still calling the latest closure.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onRejectedRef = useRef(onRejectedTransition);
  onRejectedRef.current = onRejectedTransition;
  const onSpeakEndRef = useRef(onSpeakEnd);
  onSpeakEndRef.current = onSpeakEnd;
  const autoSubmitRef = useRef(autoSubmit);
  autoSubmitRef.current = autoSubmit;

  // ── Voice activity detection ──────────────────────────────────────────────
  const vadEnabled = vad !== false;
  // Thresholds are read out by value so a caller passing an inline object
  // literal — the ordinary way to pass one — does not rebuild the config and
  // restart the detector on every render.
  const vadOverrides = vad === false ? undefined : vad;
  const vadStart = vadOverrides?.startThreshold;
  const vadEnd = vadOverrides?.endThreshold;
  const vadSilence = vadOverrides?.silenceTimeoutMs;
  const vadMinSpeech = vadOverrides?.minSpeechMs;
  const vadDebounce = vadOverrides?.startDebounceMs;
  const vadConfig = useMemo(
    () =>
      resolveVadConfig({
        startThreshold: vadStart,
        endThreshold: vadEnd,
        silenceTimeoutMs: vadSilence,
        minSpeechMs: vadMinSpeech,
        startDebounceMs: vadDebounce,
      }),
    [vadStart, vadEnd, vadSilence, vadMinSpeech, vadDebounce]
  );
  const vadConfigRef = useRef(vadConfig);
  vadConfigRef.current = vadConfig;
  const vadEnabledRef = useRef(vadEnabled);
  vadEnabledRef.current = vadEnabled;

  const [vadPhase, setVadPhase] = useState<VadPhase>("IDLE");
  const vadStateRef = useRef<VadState>(idleVadState());
  // The level is read from a ref on a fixed clock rather than reacted to,
  // because `setVolume` with an unchanged number does not re-render — and a
  // silent room produces exactly that. Driving the detector off renders would
  // stall it at the one moment it has to act.
  const volumeRef = useRef(0);

  /** Attempt a move. Returns the new state, or `null` if it was refused. */
  const apply = useCallback(
    (event: VoiceTurnEvent, reason?: string): VoiceTurnState | null => {
      const from = stateRef.current;
      const to = nextVoiceTurnState(from, event);
      if (to === null) {
        const rejected: RejectedTransition = {
          from,
          event,
          reason: reason ?? REFUSAL_REASON[event],
        };
        setLastRejected(rejected);
        onRejectedRef.current?.(rejected);
        return null;
      }
      stateRef.current = to;
      setTurnState(to);
      setLastRejected(null);
      return to;
    },
    []
  );

  /** Record a refusal that the table cannot express, such as an empty transcript. */
  const refuse = useCallback((event: VoiceTurnEvent, reason: string): false => {
    const rejected: RejectedTransition = { from: stateRef.current, event, reason };
    setLastRejected(rejected);
    onRejectedRef.current?.(rejected);
    return false;
  }, []);

  // Declared before `useVoice` so the transcript callback below never closes
  // over a binding that does not exist yet; `submitTurn` fills it in once the
  // controls are built.
  const submitRef = useRef<(text?: string) => boolean>(() => false);

  // ── The browser primitives ────────────────────────────────────────────────
  // `useVoice` is always called so the rules of hooks hold; an injected
  // implementation replaces it afterwards for tests.
  const realVoice = useVoice({
    language,
    rate,
    continuous: vadEnabled,
    onTranscript: (text, isFinal) => {
      if (!isFinal || !text.trim()) return;
      // With the VAD running, the turn ends when the room goes quiet — not when
      // the browser decides an utterance is over.
      if (vadEnabledRef.current) return;
      if (autoSubmitRef.current) submitRef.current(text);
    },
    onSpeakEnd: () => {
      // A late `onSpeakEnd` after the customer already interrupted or reset must
      // not drag the runtime back through `STOP_SPEAKING`.
      if (stateRef.current !== "SPEAKING") return;
      apply("STOP_SPEAKING");
      onSpeakEndRef.current?.();
    },
  });
  const voice = injectedVoice ?? realVoice;

  const voiceRef = useRef<VoiceHook>(voice);
  voiceRef.current = voice;
  volumeRef.current = voice.volume;

  // ── Controls ──────────────────────────────────────────────────────────────

  const startListening = useCallback(async (): Promise<boolean> => {
    if (!apply("START_LISTENING")) return false;
    setError(null);
    await voiceRef.current.startListening();
    return true;
  }, [apply]);

  const stopListening = useCallback((): boolean => {
    if (!apply("STOP_LISTENING")) return false;
    voiceRef.current.stopListening();
    return true;
  }, [apply]);

  const submitTurn = useCallback(
    (text?: string): boolean => {
      const spoken = (text ?? voiceRef.current.transcript ?? "").trim();
      if (!spoken) {
        return refuse("SUBMIT_TURN", "nothing was heard, so there is nothing to send");
      }
      if (!apply("SUBMIT_TURN")) return false;

      // The mic closes before the dispatch, not after: an open mic during
      // `PROCESSING` is how a half-heard follow-up becomes a second turn.
      voiceRef.current.stopListening();

      // The one send path. Whatever the caller passed — today that is the same
      // `sendToAdvisor` the typed composer uses — is what reaches the
      // orchestrator.
      try {
        const result = onSubmitRef.current(spoken);
        if (result instanceof Promise) {
          result.catch(() => {
            setError("The advisor could not be reached. Please try again.");
            apply("FAIL");
          });
        }
      } catch {
        setError("The advisor could not be reached. Please try again.");
        apply("FAIL");
      }
      return true;
    },
    [apply, refuse]
  );

  submitRef.current = submitTurn;

  const startSpeaking = useCallback(
    (text: string): boolean => {
      const clean = (text ?? "").trim();
      if (!clean) {
        return refuse("START_SPEAKING", "the reply was empty, so there is nothing to read out");
      }
      if (!apply("START_SPEAKING")) return false;
      voiceRef.current.speak(clean);
      return true;
    },
    [apply, refuse]
  );

  const stopSpeaking = useCallback((): boolean => {
    if (!apply("STOP_SPEAKING")) return false;
    voiceRef.current.stopSpeaking();
    return true;
  }, [apply]);

  const interrupt = useCallback((): boolean => {
    if (!apply("INTERRUPT")) return false;
    // Local audio only. Cancelling the in-flight request belongs to whoever owns
    // the stream — `useStreaming().cancel()` on the advisor page — because this
    // runtime deliberately does not hold the transport.
    voiceRef.current.stopSpeaking();
    voiceRef.current.stopListening();
    return true;
  }, [apply]);

  const reset = useCallback((): void => {
    apply("RESET");
    voiceRef.current.stopSpeaking();
    voiceRef.current.stopListening();
    voiceRef.current.retryAfterError();
    setError(null);
    setLastRejected(null);
  }, [apply]);

  // ── End-of-turn detection ─────────────────────────────────────────────────
  // Runs only while the microphone is open, and only off the level the waveform
  // analyser already produces — no second AudioContext and no second stream.
  useEffect(() => {
    if (!vadEnabled || turnState !== "LISTENING") {
      vadStateRef.current = idleVadState();
      setVadPhase("IDLE");
      return;
    }

    vadStateRef.current = armVad();
    setVadPhase("LISTENING");

    const id = setInterval(() => {
      const next = stepVad(
        vadStateRef.current,
        volumeRef.current,
        VAD_SAMPLE_MS,
        vadConfigRef.current
      );
      vadStateRef.current = next;
      setVadPhase((prev) => (prev === next.phase ? prev : next.phase));

      if (next.phase !== "SUBMITTING") return;
      // No text is passed: `submitTurn` reads the live transcript and refuses an
      // empty one, so a turn that was loud enough but produced no words is
      // dropped here rather than reaching the orchestrator.
      if (submitRef.current()) return;
      // Refused — noise carried the level but no words came back. `SUBMITTING`
      // is terminal, so without re-arming the detector would ask again on every
      // sample, twenty times a second, for as long as the microphone stayed open.
      vadStateRef.current = armVad();
      setVadPhase("LISTENING");
    }, VAD_SAMPLE_MS);

    return () => clearInterval(id);
  }, [vadEnabled, turnState]);

  // ── Failure sources ───────────────────────────────────────────────────────

  // The microphone, via `useVoice`.
  const voiceError = voice.error;
  useEffect(() => {
    if (!voiceError) return;
    setError(voiceError);
    if (stateRef.current !== "ERROR") apply("FAIL");
  }, [voiceError, apply]);

  // The stream the caller owns. Watched, never driven: a dispatch that ends in
  // `error` has to end the turn too, or the mic stays locked out behind a
  // `PROCESSING` that will never resolve.
  const streamPhase = stream?.phase;
  const streamError = stream?.error;
  useEffect(() => {
    if (streamPhase !== "error") return;
    if (stateRef.current !== "PROCESSING") return;
    setError(streamError ?? "The advisor could not answer just now. Please try again.");
    apply("FAIL");
  }, [streamPhase, streamError, apply]);

  // Reads the rendered state rather than the ref: `can` exists to enable and
  // disable controls, so it has to agree with what is on screen. The ref is for
  // the guards inside the controls, where a stale render would let two moves
  // through in one tick.
  const can = useCallback(
    (event: VoiceTurnEvent) => canVoiceTurn(turnState, event),
    [turnState]
  );

  return useMemo(
    () => ({
      turnState,
      hardwareState: voice.voiceState,
      transcript: voice.transcript,
      error,
      volume: voice.volume,
      vadPhase,
      isListening: turnState === "LISTENING",
      isSpeaking: turnState === "SPEAKING",
      isBusy: turnState === "PROCESSING",
      lastRejected,
      can,
      startListening,
      stopListening,
      submitTurn,
      startSpeaking,
      stopSpeaking,
      interrupt,
      reset,
    }),
    [
      turnState,
      voice.voiceState,
      voice.transcript,
      voice.volume,
      vadPhase,
      error,
      lastRejected,
      can,
      startListening,
      stopListening,
      submitTurn,
      startSpeaking,
      stopSpeaking,
      interrupt,
      reset,
    ]
  );
}
