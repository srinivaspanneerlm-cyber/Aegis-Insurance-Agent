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
 *     FastAPI `/chat/stream` → `CentralOrchestrator.dispatch`) is untouched.
 *     Step 4 added one outbound call — a recording posted to
 *     `/voice/transcribe` — and it is deliberately not a second transport: it
 *     lives in `services/speechToText`, it carries no conversation state, and
 *     its only output is a string that then goes through `submitTurn` like any
 *     other. Nothing about a turn's *dispatch* happens here.
 *   - It owns no send path. `submitTurn` calls back into the caller's existing
 *     `sendToAdvisor`, the same function the typed composer and the current
 *     `VoiceEngine` already use. There is exactly one way into the orchestrator
 *     and this is not a second one.
 *   - It owns no session or memory. Turns ride the existing `aegis_session_id`,
 *     so a spoken turn and a typed turn are the same conversation to
 *     `SessionManager`, `ConversationMiddleware` and `MemoryOrchestrator`.
 *
 * Since built on top, without changing the table: Step 3's VAD decides when a
 * turn ends, and Step 4's server transcription decides what was said in it.
 * Both are separate axes — `vadPhase` and `isTranscribing` — rather than new
 * turn states, because neither changes what a *turn* is allowed to do. A
 * recording being uploaded is still `LISTENING`: it has not reached the
 * orchestrator, and the guard that matters is still the one that stops a second
 * dispatch during `PROCESSING`.
 *
 * Still not here, on purpose: streaming LLM, TTS redesign, barge-in. The state
 * machine leaves room — `INTERRUPTED` exists and `SPEAKING → LISTENING` is
 * deliberately *not* a legal move yet, because barge-in needs a half-duplex
 * lock that has not been built.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVoice, type VoiceHook, type VoiceState } from "./useVoice";
import type { StreamState } from "./useStreaming";
import {
  BARGE_IN_VAD_CONFIG,
  VAD_SAMPLE_MS,
  armVad,
  idleVadState,
  resolveVadConfig,
  stepVad,
  type VadConfig,
  type VadPhase,
  type VadState,
} from "@/lib/vad";
import { SpeechToTextError, transcribeAudio } from "@/services/speechToText";
import {
  MAX_UNSPOKEN_CHARS,
  isWorthSpeaking,
  takeSpeakableSentences,
  truncateAtStructuredTag,
} from "@/lib/speech";
import {
  detectSpeakingStyle,
  endsWithQuestion,
  isStopPhrase,
  maxUnspokenCharsFor,
  type SpeakingStyle,
  type VoiceContext,
} from "@/lib/voiceStyle";

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
 * `RECOVERING`  — a *transient* failure is being waited out automatically: a
 *                 flaky STT provider call, a dropped stream, a synthesiser that
 *                 errored mid-sentence. Unlike a bare `ERROR`, nothing about it
 *                 needs the customer's acknowledgement — the mic was never the
 *                 problem, so nothing here should require them to touch it.
 *                 Reached only from `ERROR` via `RECOVER`, and only for the
 *                 specific failures `attemptRecovery` chooses to route this
 *                 way; a mic or browser permission failure still goes straight
 *                 to a bare `ERROR` and stays there.
 */
export type VoiceTurnState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "ERROR"
  | "RECOVERING";

/**
 * What can happen to a turn. Seven of these are the public controls; `FAIL` is
 * raised internally when `useVoice` reports a microphone error or the observed
 * stream ends in one. `RECOVER` and `RECOVERY_DONE` are internal too — driven
 * by `attemptRecovery`, never called directly by a caller.
 */
export type VoiceTurnEvent =
  | "START_LISTENING"
  | "STOP_LISTENING"
  | "SUBMIT_TURN"
  | "START_SPEAKING"
  | "STOP_SPEAKING"
  | "INTERRUPT"
  | "RESET"
  | "FAIL"
  | "RECOVER"
  | "RECOVERY_DONE";

export const VOICE_TURN_STATES: readonly VoiceTurnState[] = [
  "IDLE",
  "LISTENING",
  "PROCESSING",
  "SPEAKING",
  "INTERRUPTED",
  "ERROR",
  "RECOVERING",
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
  "RECOVER",
  "RECOVERY_DONE",
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
    // Only `attemptRecovery` raises this, and only for the transient failures
    // it chooses to — a bare mic/browser `FAIL` is never followed by it.
    RECOVER: "RECOVERING",
  },
  RECOVERING: {
    // The wait succeeded: back to a clean slate, same as any other reset.
    RECOVERY_DONE: "IDLE",
    // A second failure inside the recovery window is not treated as
    // transient a second time — it lands on the bare `ERROR` a customer has
    // to acknowledge, rather than retrying silently forever.
    FAIL: "ERROR",
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

// ── Voice session ────────────────────────────────────────────────────────────

/**
 * Where this voice turn sits, assembled from state that already exists.
 *
 * Not a second session store: every field here is either read straight off
 * `VoiceRuntimeOptions` (`sessionId`, `userId`, `agent`, `language`) or off
 * state the turn machine already keeps (`turnId`, `turnState`). `turnId`
 * doubles as `activeGenerationId` rather than a second counter existing beside
 * it — see the note on `turnId` below for why it already is one. The one
 * genuinely new piece is `lastCompletedTurn`, because nothing before this
 * tracked which turn's reply actually finished reaching the customer.
 *
 * A caller recovering after a reload or a reconnect reads this to decide
 * whether it is still the same conversation (`sessionId`/`conversationId`) and
 * whether a turn it has in hand has already been delivered
 * (`lastCompletedTurn` >= that turn's id) before considering resubmitting it.
 */
export interface VoiceSession {
  /** The conversation this turn rides, straight from `aegis_session_id`. */
  sessionId: string;
  /** No separate concept exists today — a conversation *is* a session here. */
  conversationId: string;
  /** The turn in progress, or the last one if none is. */
  turnId: number;
  /** Always `null` client-side; identity is asserted server-side only. */
  userId: string | null;
  currentAgent: { name: string | null; domain: string | null };
  language: string;
  voiceState: VoiceTurnState;
  /** The last turn whose reply the customer actually received. `null` before one has. */
  lastCompletedTurn: number | null;
  /** Reuses `turnId` — see the type doc above for why a second counter is not needed. */
  activeGenerationId: number;
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
   * Who turns audio into words.
   *
   * `"browser"` keeps the original `SpeechRecognition` path and is the default,
   * so an existing caller is unchanged. `"server"` records with `MediaRecorder`
   * and posts the audio to `/voice/transcribe`, which is what lets voice work
   * in Firefox, Safari and Brave — and what makes Tamil and Thanglish a
   * provider setting rather than a browser lottery.
   *
   * Either way the transcript ends up in the same place: `submitTurn`, and from
   * there the caller's existing send path. There is still exactly one door into
   * the orchestrator.
   */
  transcription?: "browser" | "server";
  /**
   * Who is answering, and where the turn sits, straight from the live stream.
   *
   * Observed, never owned. The advisor and the conversation stage are decided
   * by the orchestrator and the middleware; the runtime reads them so it can
   * decide how to *deliver* a reply without keeping a second state machine
   * that would then need keeping in sync with the real one.
   */
  agent?: {
    name?: string | null;
    domain?: string | null;
    conversationState?: string | null;
    intent?: string | null;
  };
  /**
   * The conversation this turn belongs to, straight from `aegis_session_id`.
   *
   * Observed, like `agent` — the runtime mints no session of its own and reads
   * this only to surface it on `session` below, so a caller recovering from a
   * reload can tell whether it is still the same conversation.
   */
  sessionId?: string;
  /**
   * The authenticated customer, when the caller has one to offer.
   *
   * The frontend never asserts identity to the AI engine — that comes from the
   * verified session server-side (see `backend/CLAUDE.md`) — so this is surfaced
   * on `session` for shape completeness only and is `null` on every caller
   * today. Not read for any decision here.
   */
  userId?: string | null;
  /**
   * Reopen the microphone by itself when the advisor's reply ends on a question.
   *
   * A human advisor who asks something stops talking and waits. A voice
   * interface that asks and then goes silent has, from the customer's side,
   * simply stopped — and asking them to reach for a button between every answer
   * is exactly the friction voice was supposed to remove. Only ever follows a
   * turn the customer spoke, so typed chat never opens a microphone.
   */
  handsFree?: boolean;
  /**
   * Let the customer cut in while the advisor is speaking.
   *
   * The microphone stays open through the reply — with echo cancellation, so
   * the level meter does not hear Aegis and cut Aegis off — and confirmed
   * speech stops the advisor mid-sentence. Server transcription only: the
   * browser recogniser has no way to listen beside an active speaker.
   */
  bargeIn?: boolean;
  /**
   * Abandon the response currently streaming. Called on barge-in.
   *
   * The runtime owns no transport, so cancelling is the caller's to do — on
   * the advisor page this is `useStreaming().cancel`. It abandons *this
   * reply*, never the conversation: the orchestrator's turn completes
   * server-side, so the profile and the memory it wrote stay consistent.
   */
  onCancelResponse?: () => void;
  /** Fired when the customer cut in, for diagnostics. */
  onBargeIn?: (turnId: number) => void;
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
  /**
   * The recording is being turned into words.
   *
   * A separate axis from `turnState`, like `vadPhase` — the turn has not been
   * handed to the orchestrator yet, so it is genuinely still `LISTENING`, but
   * the customer needs to see that something is happening in the seconds the
   * upload takes. Always false in browser mode, where transcription is
   * instantaneous and local.
   */
  isTranscribing: boolean;
  /**
   * What the transcription service heard the language as — `en-IN`, `ta-IN`, or
   * `ta-en` for Thanglish. Metadata, carried and not acted on: the transcript
   * reaches the advisor verbatim and the existing language layer reads it there
   * exactly as it reads a typed message.
   */
  detectedLanguage: string | null;
  /**
   * How the customer worded this turn, and what the voice layer knows about it.
   *
   * Assembled from state that already exists — the turn machine, the STT
   * result, the live stream — so there is nothing here to keep in sync and
   * nothing persisted. Null until a spoken turn is submitted.
   */
  voiceContext: VoiceContext | null;
  /** How this turn was worded. `normal` until something is spoken. */
  speakingStyle: SpeakingStyle;
  /**
   * Which turn is live, counting from 1.
   *
   * Bumped whenever a turn is submitted, interrupted, cut into or reset. Every
   * asynchronous continuation in the voice path — a transcription in flight, a
   * queued sentence, a token arriving from the stream — belongs to the turn
   * that started it, and anything holding an older number is discarded rather
   * than acted on. It is what makes "the customer cut in" and "a reply arrived
   * late" impossible to confuse.
   */
  turnId: number;
  /** Whether the advisor was cut into during the last turn. */
  wasInterrupted: boolean;
  /**
   * When the first sentence of this turn actually started playing, as a
   * `performance.now()` reading. The number the whole streaming path exists to
   * move; null until audio begins.
   */
  firstAudioAt: number | null;
  /** The last refused move, cleared by the next accepted one. */
  lastRejected: RejectedTransition | null;
  /**
   * A transient failure — a flaky STT call, a dropped stream, a synthesiser
   * error — is being waited out automatically. `true` only in `RECOVERING`;
   * a mic/browser failure never sets this, since those stay a bare `ERROR`.
   */
  isRecovering: boolean;
  /** This turn's session, assembled for a caller handling a reload or reconnect. */
  session: VoiceSession;
  /** Whether a move would be accepted right now — for enabling controls. */
  can: (event: VoiceTurnEvent) => boolean;

  /** Open the mic. Resolves `false` if the move was refused. */
  startListening: () => Promise<boolean>;
  /** Close the mic without sending anything. Any recording is discarded. */
  stopListening: () => boolean;
  /**
   * The customer is finished speaking — end the turn and send what they said.
   *
   * Distinct from `stopListening`, which cancels. In browser mode the two are
   * the same thing, because the recogniser there owns its own utterance
   * boundaries; in server mode this is what flushes the recording into
   * transcription. Callers should use this for a "done" control and
   * `stopListening` only for an explicit cancel.
   */
  endTurn: () => boolean;
  /** Hand this turn to the caller's send path. Defaults to the live transcript. */
  submitTurn: (text?: string) => boolean;
  /** Read a reply aloud, all at once. The replay button, and the non-streamed path. */
  startSpeaking: (text: string) => boolean;
  /**
   * Feed the accumulated reply as it streams in, speaking each sentence the
   * moment it is complete.
   *
   * The alternative — what this replaces — is `startSpeaking(wholeReply)` once
   * the turn is over, which means the customer hears nothing until the model
   * has finished writing. Everything before the first full stop is dead air.
   *
   * Silent unless a *spoken* turn is in progress, so a typed message streams
   * to the screen exactly as it always has and says nothing out loud.
   *
   * `ownerTurn` is the `turnId` the caller read when it started this reply.
   * Tokens carrying an older number belong to a reply the customer has cut
   * into and are dropped rather than spoken.
   */
  pushStreamedText: (accumulated: string, ownerTurn?: number) => void;
  /**
   * The stream is over. Speaks whatever is left in the buffer and closes the
   * turn once the queue drains. Returns false when there was nothing worth
   * saying at all, so the caller can release a turn that would otherwise sit
   * in `PROCESSING` waiting for audio that is never coming.
   */
  finishStreamedTurn: (finalText?: string, ownerTurn?: number) => boolean;
  /**
   * The turn diverged: what was streamed is retracted and this is the truth.
   * Drops anything queued, stops the utterance in flight, and starts again
   * from the corrected text.
   */
  replaceStreamedText: (text: string, ownerTurn?: number) => void;
  /** Stop reading and end the turn. */
  stopSpeaking: () => boolean;
  /** The customer stopped the turn. Halts local audio; the stream is the caller's. */
  interrupt: () => boolean;
  /**
   * The customer cut in while the advisor was talking: stop speaking and listen.
   *
   * Composed from two moves the machine already allows — `INTERRUPT` then
   * `START_LISTENING` — rather than a new transition, so the half-duplex
   * invariant still holds: the speaker is silenced *before* the microphone
   * opens, never alongside it. This is the deliberate kind of interruption, a
   * button or a gesture; hearing the customer over the advisor's own audio is
   * acoustic barge-in and is still not built.
   */
  interruptAndListen: () => Promise<boolean>;
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
  RECOVER: "there is nothing to recover from",
  RECOVERY_DONE: "recovery is not in progress",
};

/**
 * How much monitored silence to hold before recycling the buffer.
 *
 * Long enough that a customer drawing breath mid-interruption is never clipped,
 * short enough that a long reply does not leave a long recording behind it.
 */
const MONITOR_RECYCLE_MS = 4000;

export function useVoiceRuntime(options: VoiceRuntimeOptions): VoiceRuntime {
  const {
    onSubmit,
    stream,
    language = "en-IN",
    rate = 0.93,
    autoSubmit = true,
    vad,
    transcription = "browser",
    agent,
    handsFree = true,
    bargeIn = true,
    onCancelResponse,
    onBargeIn,
    onSpeakEnd,
    onRejectedTransition,
    voice: injectedVoice,
    sessionId = "",
    userId = null,
  } = options;
  const serverTranscription = transcription === "server";

  const [turnState, setTurnState] = useState<VoiceTurnState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [lastRejected, setLastRejected] = useState<RejectedTransition | null>(null);
  // The last turn whose reply actually reached the customer — set only off the
  // stream's own `done` signal, never guessed from the turn machine's state, so
  // a caller recovering after a reload can tell a delivered turn apart from one
  // that is merely no longer in flight.
  const [lastCompletedTurn, setLastCompletedTurn] = useState<number | null>(null);
  const lastCompletedTurnRef = useRef<number | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // ── Server transcription ──────────────────────────────────────────────────
  // `endOfTurn` covers the whole gap between "stop recording" and "we know what
  // they said" — the flush, the upload and the provider call. It is state, not
  // just a ref, because the VAD effect keys off it: while it is true the
  // detector is torn down, and when it goes false the effect re-arms, which is
  // exactly the behaviour a turn that produced no words needs.
  const [endOfTurn, setEndOfTurn] = useState(false);
  const endOfTurnRef = useRef(false);
  // What ends the turn decides what happens if nothing was heard: a VAD-ended
  // turn goes back to listening (the room was noisy, they may still be
  // thinking), a customer-ended one closes the mic (they said they were done).
  const endIntentRef = useRef<"vad" | "manual">("vad");
  const [sttTranscript, setSttTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  // Read synchronously when a turn is submitted, which happens in the same tick
  // the transcript resolves — a render behind would send the previous turn's
  // language with this turn's words.
  const detectedLanguageRef = useRef<string | null>(null);
  // Lets an interrupt or a reset abandon an upload already in flight, rather
  // than having its result arrive into a turn the customer has since left.
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const serverTranscriptionRef = useRef(serverTranscription);
  serverTranscriptionRef.current = serverTranscription;

  // ── Streaming speech ──────────────────────────────────────────────────────
  // Sentences waiting their turn at the speaker. A queue rather than a series
  // of `speak()` calls because `useVoice.speak` cancels whatever is playing
  // before it starts — fired twice in a row it would talk over itself, and the
  // customer would hear the second half of one sentence under the first half of
  // the next.
  const speechQueueRef = useRef<string[]>([]);
  // Text received but not yet a complete sentence.
  const speechBufferRef = useRef("");
  // How much of the accumulated reply has already been turned into sentences.
  // The stream sends the whole reply each time, not the delta.
  const consumedRef = useRef("");
  // Whether more text is still coming. False by default, so an ordinary
  // `startSpeaking` — the replay button, the non-streamed path — ends its turn
  // on the first `onSpeakEnd` exactly as it always did.
  const streamOpenRef = useRef(false);
  // An utterance is with the speech synthesiser right now.
  const utteranceInFlightRef = useRef(false);
  const firstAudioAtRef = useRef<number | null>(null);
  const [firstAudioAt, setFirstAudioAt] = useState<number | null>(null);

  // ── Adaptive delivery ─────────────────────────────────────────────────────
  // How this turn was worded, decided once when it is submitted and held for
  // the whole turn. Recomputing it per token would let the style flicker
  // mid-reply, which is audible.
  const [speakingStyle, setSpeakingStyle] = useState<SpeakingStyle>("normal");
  const styleRef = useRef<SpeakingStyle>("normal");
  // Whether the reply that just finished handed the conversation back.
  const resumeAfterReplyRef = useRef(false);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  // Consecutive hands-free openings that produced nothing. A microphone that
  // reopens after every question would otherwise stay open indefinitely once
  // the customer walks away from it.
  const emptyContinuationsRef = useRef(0);
  const agentMetaRef = useRef(agent);
  agentMetaRef.current = agent;
  const [voiceContext, setVoiceContext] = useState<VoiceContext | null>(null);

  // ── Turn ownership ────────────────────────────────────────────────────────
  // One live turn, identified by a number that only goes up. Everything that
  // happens later and asynchronously — a transcription coming back, a sentence
  // reaching the speaker, a token arriving from the stream — carries the number
  // of the turn it belongs to and is dropped if that turn is over. State alone
  // is not enough for this: "the runtime is LISTENING" cannot tell turn 4's
  // late `onDone` apart from turn 5 legitimately in progress.
  const turnIdRef = useRef(0);
  const [turnId, setTurnId] = useState(0);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  // How long the monitoring buffer has been accumulating silence.
  const monitorAgeRef = useRef(0);
  const bargeInRef = useRef(bargeIn);
  bargeInRef.current = bargeIn;
  const onCancelResponseRef = useRef(onCancelResponse);
  onCancelResponseRef.current = onCancelResponse;
  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;

  /** Start a new turn and orphan everything belonging to the last one. */
  const nextTurn = useCallback((): number => {
    const id = turnIdRef.current + 1;
    turnIdRef.current = id;
    setTurnId(id);
    return id;
  }, []);

  /** Whether `id` is still the turn in progress. */
  const isCurrentTurn = useCallback((id: number | undefined): boolean => {
    return id === undefined || id === turnIdRef.current;
  }, []);
  const languageRef = useRef(language);
  languageRef.current = language;

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

  // ── The speech pump ───────────────────────────────────────────────────────
  // Declared before `useVoice` so the `onSpeakEnd` callback registered below
  // can drive it; filled in once the controls exist.
  const pumpRef = useRef<() => void>(() => {});
  // Filled in once `startListening` exists; called when a reply finishes.
  const maybeResumeListeningRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => Promise<boolean>>(async () => false);
  const interruptRef = useRef<() => boolean>(() => false);

  /** Forget everything about a streamed turn's audio. */
  const resetSpeechStream = useCallback(() => {
    resumeAfterReplyRef.current = false;
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    consumedRef.current = "";
    streamOpenRef.current = false;
    utteranceInFlightRef.current = false;
    firstAudioAtRef.current = null;
    setFirstAudioAt(null);
  }, []);

  // ── Recovery ──────────────────────────────────────────────────────────────
  // How long to wait out a transient failure before declaring the runtime safe
  // again. Long enough that a one-off STT hiccup or a momentary dropped stream
  // does not flash the error banner and clear it before a customer could read
  // it; short enough that this never reads as a second, silent hang on top of
  // the one that just happened.
  const RECOVERY_MS = 900;
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current !== null) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  /**
   * Wait out a *transient* failure instead of leaving it a bare `ERROR`.
   *
   * Reserved for failures that are not the customer's mic or browser — an STT
   * provider call that timed out, a dropped stream, a synthesiser that errored
   * mid-sentence. Nothing about those needs acknowledgement, so this clears
   * itself automatically rather than waiting on `reset()`.
   *
   * Nothing still in flight for the failed turn is allowed to survive into the
   * recovered state: the speech queue is dropped and any playing utterance is
   * stopped, so recovering never replays audio from the turn that just failed;
   * a transcription upload in the air is aborted, so its result cannot arrive
   * late into whatever the customer does next. `sessionId`, `lastCompletedTurn`
   * and `turnId` are untouched — this is a pause, not a reset of what the
   * conversation already has.
   */
  const attemptRecovery = useCallback(
    (message: string) => {
      setError(message);
      if (!apply("FAIL")) return;
      transcribeAbortRef.current?.abort();
      voiceRef.current.stopSpeaking();
      resetSpeechStream();
      if (!apply("RECOVER")) return;

      clearRecoveryTimer();
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null;
        // Something else already moved the runtime on — a manual reset, or a
        // second failure that has already re-armed this same timer.
        if (stateRef.current !== "RECOVERING") return;
        apply("RECOVERY_DONE");
        setError(null);
        voiceRef.current.retryAfterError();
        maybeResumeListeningRef.current();
      }, RECOVERY_MS);
    },
    // `apply`, `resetSpeechStream`, `clearRecoveryTimer` and `voiceRef` are all
    // stable; listed for the linter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Say the next sentence, if there is one and nothing is already playing.
   *
   * The only place `voice.speak` is called for a streamed turn, which is what
   * makes overlapping audio structurally impossible rather than merely
   * unlikely: a second utterance cannot start until `onSpeakEnd` has cleared
   * the one before it.
   */
  const pumpSpeech = useCallback(() => {
    if (utteranceInFlightRef.current) return;

    const state = stateRef.current;
    if (state !== "PROCESSING" && state !== "SPEAKING") return;

    const next = speechQueueRef.current.shift();
    if (next === undefined) {
      // Nothing queued. If the stream is closed too, the turn is genuinely
      // over — otherwise this is just the gap between two sentences and the
      // runtime stays in `SPEAKING` waiting for the next one.
      if (!streamOpenRef.current && state === "SPEAKING") {
        apply("STOP_SPEAKING");
        onSpeakEndRef.current?.();
        maybeResumeListeningRef.current();
      }
      return;
    }

    // First sentence of the turn: this is the move from "thinking" to
    // "talking", and the one transition the machine has to approve.
    if (state === "PROCESSING" && !apply("START_SPEAKING")) {
      // Refused — put it back rather than dropping what the advisor said.
      speechQueueRef.current.unshift(next);
      return;
    }

    utteranceInFlightRef.current = true;
    if (firstAudioAtRef.current === null) {
      const at = typeof performance !== "undefined" ? performance.now() : Date.now();
      firstAudioAtRef.current = at;
      setFirstAudioAt(at);
    }
    voiceRef.current.speak(next);
  }, [apply]);
  pumpRef.current = pumpSpeech;

  /** Take everything speakable out of the buffer and queue it. */
  const enqueueFromBuffer = useCallback((atEnd: boolean) => {
    // Only the length fallback tightens with style — the sentence rule is the
    // same for everyone. A turn worded with time pressure should not wait
    // behind a long clause for its first full stop.
    const { sentences, rest } = takeSpeakableSentences(
      speechBufferRef.current,
      atEnd,
      maxUnspokenCharsFor(styleRef.current, MAX_UNSPOKEN_CHARS)
    );
    speechBufferRef.current = rest;
    for (const sentence of sentences) {
      // An empty or punctuation-only fragment is never queued: the synthesiser
      // says nothing and fires no end event for it, which would stall a queue
      // that waits for one.
      if (isWorthSpeaking(sentence)) speechQueueRef.current.push(sentence);
    }
  }, []);

  // Declared before `useVoice` for the same reason `submitRef` is: the audio
  // callback registered below must not close over a binding that does not exist
  // yet.
  const transcribeRef = useRef<(audio: Blob) => void>(() => {});

  /**
   * Put the turn back where it was when nothing usable came out of it.
   *
   * `keepListening` overrides what the customer's own end-of-turn implied. It
   * is set for one case: they cut in and said only "wait". They have not
   * finished — they have barely started — so closing the microphone on them
   * would be the exact opposite of what they asked for.
   */
  const abandonTurn = useCallback(
    (reason: string, keepListening = false) => {
      // Nothing was heard. Counted so a microphone that reopened by itself does
      // not keep reopening into an empty room.
      if (!keepListening) emptyContinuationsRef.current += 1;
      if (!keepListening && endIntentRef.current === "manual") {
        // They said they were finished. Closing the mic is the honest response
        // to "I'm done" plus "we heard nothing" — leaving it open would look
        // like the button did not work.
        if (apply("STOP_LISTENING")) voiceRef.current.stopListening();
      }
      refuse("SUBMIT_TURN", reason);
      // Clearing this re-runs the VAD effect, which re-arms the detector. In
      // the VAD case that is the whole recovery: the mic never closed and the
      // recorder has already restarted itself, so the customer simply keeps
      // talking.
      endOfTurnRef.current = false;
      setEndOfTurn(false);
    },
    // `apply`, `refuse` and `voiceRef` are all stable; listed for the linter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * A finished recording: transcribe it, then send it the ordinary way.
   *
   * The result does not get its own path into the orchestrator — it goes to
   * `submitTurn`, the same function the browser recogniser's final transcript
   * goes to, which calls the caller's `onSubmit`. That is why swapping which
   * side transcribes changes nothing downstream: `CentralOrchestrator` receives
   * a spoken turn identically either way.
   */
  const runTranscription = useCallback(
    async (audio: Blob) => {
      // Arrived after the customer cancelled, interrupted or reset. Their audio
      // is dropped rather than turned into a turn they no longer want.
      if (stateRef.current !== "LISTENING") {
        endOfTurnRef.current = false;
        setEndOfTurn(false);
        return;
      }

      const controller = new AbortController();
      transcribeAbortRef.current = controller;
      // Whose words these are. Checked again on the way back, because a
      // transcription takes seconds and the customer can cut in, cancel or
      // start over inside them.
      const ownerTurn = turnIdRef.current;
      try {
        const result = await transcribeAudio(audio, {
          language: languageRef.current,
          signal: controller.signal,
        });

        // The turn may have been abandoned while the upload was in the air.
        if (stateRef.current !== "LISTENING") return;
        if (!isCurrentTurn(ownerTurn)) return;

        // A request for silence, not a question. Somebody who cuts in with
        // "wait" has not asked anything — they are about to. Sending it as a
        // turn spends a paid call to have the advisor say "of course, go
        // ahead" over the top of them, which is the talking-over that barge-in
        // exists to end. The microphone simply stays open for the real thing.
        if (isStopPhrase(result.transcript)) {
          abandonTurn("that was a request to stop, not a question", true);
          return;
        }

        setSttTranscript(result.transcript);
        setDetectedLanguage(result.language);
        detectedLanguageRef.current = result.language;
        // Straight into the one send path. `submitTurn` closes the mic, guards
        // against a double dispatch and refuses an empty string on its own.
        if (!submitRef.current(result.transcript)) {
          abandonTurn("the transcript was empty, so there is nothing to send");
          return;
        }
        endOfTurnRef.current = false;
        setEndOfTurn(false);
      } catch (err) {
        if (stateRef.current !== "LISTENING" || !isCurrentTurn(ownerTurn)) {
          endOfTurnRef.current = false;
          setEndOfTurn(false);
          return;
        }

        const failure = err instanceof SpeechToTextError ? err : null;

        // Silence is not a fault. A customer whose recording held no words
        // should be able to simply speak again, not be shown an error and made
        // to acknowledge it — so this is the one failure that does not end in
        // `ERROR`.
        if (failure?.kind === "empty") {
          abandonTurn(failure.userMessage);
          return;
        }

        // A provider timeout or a failed call is not the customer's mic —
        // typing still works, and so does speaking again once this clears
        // itself, so this recovers automatically rather than sitting in a
        // bare `ERROR` waiting for `reset()`.
        endOfTurnRef.current = false;
        setEndOfTurn(false);
        voiceRef.current.stopListening();
        attemptRecovery(
          failure?.userMessage ??
            "We couldn't turn that into words. Please try again, or type your question."
        );
      } finally {
        if (transcribeAbortRef.current === controller) transcribeAbortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abandonTurn, isCurrentTurn]
  );
  transcribeRef.current = (audio: Blob) => void runTranscription(audio);

  // ── The browser primitives ────────────────────────────────────────────────
  // `useVoice` is always called so the rules of hooks hold; an injected
  // implementation replaces it afterwards for tests.
  const realVoice = useVoice({
    language,
    rate,
    continuous: vadEnabled,
    transcription,
    onAudio: (audio) => {
      // Only ever fired by `flushRecording`, so reaching here means a turn was
      // deliberately ended — never that the customer cancelled.
      transcribeRef.current(audio);
    },
    onTranscript: (text, isFinal) => {
      if (!isFinal || !text.trim()) return;
      // In server mode there is no recogniser to fire this, but an injected
      // test double can — and a browser transcript must never race the
      // server's, or one utterance becomes two turns.
      if (serverTranscriptionRef.current) return;
      // With the VAD running, the turn ends when the room goes quiet — not when
      // the browser decides an utterance is over.
      if (vadEnabledRef.current) return;
      if (autoSubmitRef.current) submitRef.current(text);
    },
    onSpeakEnd: () => {
      utteranceInFlightRef.current = false;
      // A late `onSpeakEnd` after the customer already interrupted or reset must
      // not drag the runtime back through `STOP_SPEAKING`.
      if (stateRef.current !== "SPEAKING") return;
      // One sentence finishing is not the turn finishing. The pump decides:
      // it speaks the next one if there is one, waits if more is still being
      // written, and only closes the turn when the queue is empty and the
      // stream is shut. A non-streamed reply has `streamOpenRef` false and one
      // utterance, so it takes exactly the path it always did.
      pumpRef.current();
    },
    onSpeakError: () => {
      // Without this the pump — which only ever advances on `onSpeakEnd` —
      // never learns the utterance is over, and the turn is stuck in
      // `SPEAKING` forever: the mic never reopens and nothing tells the
      // customer why. A synthesiser failing mid-sentence is not their fault
      // and not the mic's, so it recovers the same way a flaky STT call does.
      utteranceInFlightRef.current = false;
      if (stateRef.current !== "SPEAKING" && stateRef.current !== "PROCESSING") return;
      attemptRecovery("We had trouble reading that reply aloud. You can still read it on screen.");
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
  startListeningRef.current = startListening;

  /**
   * The customer cut in while the advisor was talking.
   *
   * Two moves the machine already allows, in the only order that is safe:
   * `INTERRUPT` silences the speaker and closes the mic, then `START_LISTENING`
   * opens it again. Nothing new was added to the table, and the invariant it
   * protects still holds — the advisor's audio is stopped *before* the
   * microphone opens, never alongside it.
   */
  const interruptAndListen = useCallback(async (): Promise<boolean> => {
    const state = stateRef.current;
    if (state !== "SPEAKING" && state !== "PROCESSING" && state !== "LISTENING") {
      return refuse("INTERRUPT", "there is nothing to interrupt");
    }
    if (state !== "LISTENING" && !interruptRef.current()) return false;
    // Cutting in is the customer saying they are still here.
    emptyContinuationsRef.current = 0;
    if (stateRef.current === "LISTENING") return true;
    return startListeningRef.current();
  }, [refuse]);

  const stopListening = useCallback((): boolean => {
    if (!apply("STOP_LISTENING")) return false;
    // `stopListening` on the hook discards any recording rather than emitting
    // it, so a cancel really is a cancel — the audio never leaves the device.
    voiceRef.current.stopListening();
    return true;
  }, [apply]);

  /**
   * The customer is done speaking.
   *
   * In browser mode this is exactly `stopListening`, unchanged: the recogniser
   * owns its own utterance boundaries and there is nothing buffered to flush.
   * In server mode it hands the recording to transcription and *stays* in
   * `LISTENING` until words come back — the turn has not been dispatched yet,
   * so claiming otherwise would be a lie the state machine would have to
   * unwind.
   */
  const endTurn = useCallback((): boolean => {
    if (!serverTranscriptionRef.current) return stopListening();
    if (stateRef.current !== "LISTENING") {
      return refuse("STOP_LISTENING", "there is no open turn to finish");
    }
    if (endOfTurnRef.current) {
      return refuse("SUBMIT_TURN", "this turn is already being transcribed");
    }
    endIntentRef.current = "manual";
    endOfTurnRef.current = true;
    setEndOfTurn(true);
    voiceRef.current.flushRecording();
    return true;
  }, [refuse, stopListening]);

  /**
   * Reopen the microphone, if the advisor just asked something.
   *
   * Deferred to a microtask rather than run inline: it is called from inside a
   * `STOP_SPEAKING` transition, and reopening the microphone from within the
   * move that closed the turn would have `startListening` read a state that has
   * not finished settling.
   */
  const maybeResumeListening = useCallback((): void => {
    if (!handsFreeRef.current) return;
    if (!resumeAfterReplyRef.current) return;
    resumeAfterReplyRef.current = false;
    if (!serverTranscriptionRef.current) return;
    // Two openings in a row that heard nothing means nobody is there. A
    // microphone that reopens after every question would otherwise stay open
    // for as long as the tab does.
    if (emptyContinuationsRef.current >= 2) return;
    if (stateRef.current !== "IDLE") return;

    queueMicrotask(() => {
      if (stateRef.current !== "IDLE") return;
      void startListeningRef.current();
    });
  }, []);
  maybeResumeListeningRef.current = maybeResumeListening;

  /**
   * The customer started speaking while the advisor was.
   *
   * The order matters and is the whole safety argument. The turn number moves
   * first, so everything still in flight for the old reply — a queued sentence,
   * a token about to arrive, a transcription coming back — is already orphaned
   * before anything else happens. Then the speaker is silenced, then the
   * response is abandoned, and only then does the state machine move.
   *
   * The microphone is deliberately not touched. It has been open and recording
   * throughout the reply, which is how the customer's first word — usually the
   * one that carries the interruption — is already in the buffer by the time
   * the detector is sure enough to act.
   */
  const runBargeIn = useCallback((): boolean => {
    const state = stateRef.current;
    if (state !== "SPEAKING" && state !== "PROCESSING") return false;

    const id = nextTurn();

    // Stop making noise first. Wrapped because a synthesiser that refuses to
    // cancel must not take the interruption down with it — the turn number
    // above has already made anything it goes on to say unusable, and the
    // queue is emptied below, so the worst case is one sentence finishing.
    try {
      voiceRef.current.stopSpeaking();
    } catch {
      /* nothing further can be spoken for this turn regardless */
    }
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    consumedRef.current = "";
    streamOpenRef.current = false;
    utteranceInFlightRef.current = false;
    resumeAfterReplyRef.current = false;

    // Abandon the reply, never the conversation. The orchestrator's turn
    // finishes server-side either way, so the profile and memory it wrote stay
    // consistent — what is cancelled is the presentation of an answer the
    // customer has stopped wanting.
    try {
      onCancelResponseRef.current?.();
    } catch {
      /* a caller that cannot cancel still gets a silenced, orphaned turn */
    }

    if (!apply("INTERRUPT")) return false;
    setWasInterrupted(true);
    // Straight on to listening, without reopening the microphone — it never
    // closed, and reopening would drop the words already recorded.
    if (!apply("START_LISTENING")) return false;

    emptyContinuationsRef.current = 0;
    setError(null);
    onBargeInRef.current?.(id);
    return true;
  }, [apply, nextTurn]);
  const bargeInRunRef = useRef(runBargeIn);
  bargeInRunRef.current = runBargeIn;

  const submitTurn = useCallback(
    (text?: string): boolean => {
      const spoken = (text ?? voiceRef.current.transcript ?? "").trim();
      if (!spoken) {
        return refuse("SUBMIT_TURN", "nothing was heard, so there is nothing to send");
      }
      if (!apply("SUBMIT_TURN")) return false;

      // The turn number moves before anything is dispatched, so a reply that
      // arrives for the previous turn can be told apart from this one's.
      nextTurn();
      setWasInterrupted(false);

      if (bargeInRef.current && serverTranscriptionRef.current) {
        // The microphone stays open so the customer can cut in — but nothing
        // it hears may become a second turn, and the guard that stops that is
        // the transition table: `PROCESSING` accepts no `SUBMIT_TURN`. What
        // the open microphone is *for* now is `bargeIn` above, and nothing
        // else reads it.
        //
        // The buffer is emptied rather than kept: everything recorded up to
        // here has just been transcribed and sent, and replaying it under the
        // reply would submit the same sentence twice.
        voiceRef.current.discardRecording();
      } else {
        // The mic closes before the dispatch, not after: an open mic during
        // `PROCESSING` is how a half-heard follow-up becomes a second turn.
        voiceRef.current.stopListening();
      }
      // A new turn starts with an empty mouth. Anything left queued belongs to
      // the previous answer and must not be spoken over this one.
      resetSpeechStream();

      // How this turn was worded, decided once and held for the whole turn.
      // A description of the sentence, never a claim about the customer — see
      // `lib/voiceStyle`. Recomputing it per token would let the style flicker
      // mid-reply, which is audible.
      const style = detectSpeakingStyle(spoken);
      styleRef.current = style;
      setSpeakingStyle(style);
      setVoiceContext({
        style,
        language: detectedLanguageRef.current,
        spoken: true,
        agentName: agentMetaRef.current?.name ?? null,
        agentDomain: agentMetaRef.current?.domain ?? null,
        conversationState: agentMetaRef.current?.conversationState ?? null,
        intent: agentMetaRef.current?.intent ?? null,
        transcript: spoken,
      });
      // A turn that produced words is a customer who is still there.
      emptyContinuationsRef.current = 0;

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
    [apply, refuse, resetSpeechStream, nextTurn]
  );

  submitRef.current = submitTurn;

  const startSpeaking = useCallback(
    (text: string): boolean => {
      const clean = (text ?? "").trim();
      if (!clean) {
        return refuse("START_SPEAKING", "the reply was empty, so there is nothing to read out");
      }
      if (!apply("START_SPEAKING")) return false;
      // A one-shot utterance, so any leftover stream state is cleared first:
      // `streamOpenRef` false means the single `onSpeakEnd` closes the turn,
      // which is the behaviour this control has always had.
      resetSpeechStream();
      utteranceInFlightRef.current = true;
      voiceRef.current.speak(clean);
      return true;
    },
    [apply, refuse, resetSpeechStream]
  );

  const pushStreamedText = useCallback(
    (accumulated: string, ownerTurn?: number): void => {
      // A token from a reply the customer has already cut into. Dropped rather
      // than spoken — this is the late chunk `turnId` exists for.
      if (!isCurrentTurn(ownerTurn)) return;
      const state = stateRef.current;
      // Only a spoken turn is read aloud. A typed message reaches `onToken`
      // exactly as before and leaves the runtime `IDLE`, so this returns here
      // and the composer behaves as it always has.
      if (state !== "PROCESSING" && state !== "SPEAKING") return;

      // Everything from `[RECOMMENDATION:` onwards is a card, not speech. It is
      // truncated rather than stripped because the closing bracket has not
      // arrived yet — and nothing after a tag is ever meant to be heard.
      const speakable = truncateAtStructuredTag(accumulated ?? "");
      if (speakable.length <= consumedRef.current.length) return;

      speechBufferRef.current += speakable.slice(consumedRef.current.length);
      consumedRef.current = speakable;
      streamOpenRef.current = true;
      enqueueFromBuffer(false);
      pumpRef.current();
    },
    [enqueueFromBuffer, isCurrentTurn]
  );

  const finishStreamedTurn = useCallback(
    (finalText?: string, ownerTurn?: number): boolean => {
      // The old turn's `onDone`, arriving after the customer moved on. It must
      // not close, reset or speak for the turn that replaced it.
      if (!isCurrentTurn(ownerTurn)) return false;
      const state = stateRef.current;
      if (state !== "PROCESSING" && state !== "SPEAKING") {
        resetSpeechStream();
        return false;
      }

      // The authoritative text, in case the last tokens and the final reply
      // disagree — the tail arrives in one piece, so this catches it.
      if (finalText) pushStreamedText(finalText);

      // Whether the advisor handed the conversation back. Read off the reply
      // itself: the question mark is right there, and asking the server to
      // confirm it would be slower and no more certain. Only ever consulted
      // for a turn the customer spoke.
      resumeAfterReplyRef.current = endsWithQuestion(finalText ?? consumedRef.current);

      // `atEnd`: a closing sentence with no trailing space, or none with any
      // terminator at all, is still worth saying.
      enqueueFromBuffer(true);
      streamOpenRef.current = false;

      if (speechQueueRef.current.length === 0 && !utteranceInFlightRef.current) {
        // Nothing to say. Reported rather than swallowed so the caller can
        // release a turn that would otherwise sit in `PROCESSING` waiting for
        // audio that is never coming — the same contract the old
        // `startSpeaking` had when it refused an empty reply.
        if (state === "PROCESSING") return false;
      }

      pumpRef.current();
      return true;
    },
    [enqueueFromBuffer, pushStreamedText, resetSpeechStream, isCurrentTurn]
  );

  const replaceStreamedText = useCallback(
    (text: string, ownerTurn?: number): void => {
      if (!isCurrentTurn(ownerTurn)) return;
      const state = stateRef.current;
      if (state !== "PROCESSING" && state !== "SPEAKING") return;

      // Everything queued was part of a reply this turn no longer makes.
      speechQueueRef.current = [];
      speechBufferRef.current = "";
      consumedRef.current = "";
      utteranceInFlightRef.current = false;
      voiceRef.current.stopSpeaking();
      streamOpenRef.current = true;
      pushStreamedText(text);
    },
    [pushStreamedText, isCurrentTurn]
  );

  const stopSpeaking = useCallback((): boolean => {
    if (!apply("STOP_SPEAKING")) return false;
    resetSpeechStream();
    voiceRef.current.stopSpeaking();
    return true;
  }, [apply, resetSpeechStream]);

  const interrupt = useCallback((): boolean => {
    if (!apply("INTERRUPT")) return false;
    // A transcription still in the air belongs to a turn the customer has just
    // walked away from. Abandoned rather than awaited, so its result cannot
    // arrive later and speak for them.
    transcribeAbortRef.current?.abort();
    endOfTurnRef.current = false;
    setEndOfTurn(false);
    // Sentences still queued belong to a turn the customer has walked away
    // from. Dropped, or the advisor keeps talking after being stopped.
    resetSpeechStream();
    // Local audio only. Cancelling the in-flight request belongs to whoever owns
    // the stream — `useStreaming().cancel()` on the advisor page — because this
    // runtime deliberately does not hold the transport.
    voiceRef.current.stopSpeaking();
    voiceRef.current.stopListening();
    return true;
  }, [apply, resetSpeechStream]);
  interruptRef.current = interrupt;

  const reset = useCallback((): void => {
    apply("RESET");
    clearRecoveryTimer();
    transcribeAbortRef.current?.abort();
    endOfTurnRef.current = false;
    endIntentRef.current = "vad";
    setEndOfTurn(false);
    setSttTranscript("");
    setDetectedLanguage(null);
    detectedLanguageRef.current = null;
    styleRef.current = "normal";
    setSpeakingStyle("normal");
    setVoiceContext(null);
    emptyContinuationsRef.current = 0;
    resetSpeechStream();
    voiceRef.current.stopSpeaking();
    voiceRef.current.stopListening();
    voiceRef.current.retryAfterError();
    setError(null);
    setLastRejected(null);
  }, [apply, resetSpeechStream, clearRecoveryTimer]);

  // A pending recovery timer must not fire into an unmounted component.
  useEffect(() => clearRecoveryTimer, [clearRecoveryTimer]);

  // ── End-of-turn detection ─────────────────────────────────────────────────
  // Runs only while the microphone is open, and only off the level the waveform
  // analyser already produces — no second AudioContext and no second stream.
  useEffect(() => {
    // Two jobs, one detector. While the customer has the floor it is watching
    // for the end of their turn; while the advisor has it, it is watching for
    // them to take the floor back. The machine is identical — only the
    // thresholds and what happens on a positive differ.
    const monitoring =
      bargeIn &&
      transcription === "server" &&
      (turnState === "SPEAKING" || turnState === "PROCESSING");

    // `endOfTurn` pauses the detector for the whole flush-upload-transcribe
    // gap. Without it the detector would sit in `SUBMITTING`, which is
    // terminal, and ask again on every sample — twenty times a second, each one
    // another upload of the same sentence.
    if (!vadEnabled || (turnState !== "LISTENING" && !monitoring) || endOfTurn) {
      vadStateRef.current = idleVadState();
      setVadPhase("IDLE");
      return;
    }

    vadStateRef.current = armVad();
    setVadPhase("LISTENING");
    monitorAgeRef.current = 0;

    const id = setInterval(() => {
      const next = stepVad(
        vadStateRef.current,
        volumeRef.current,
        VAD_SAMPLE_MS,
        // Barge-in asks for more evidence: a louder sound, held longer. The
        // microphone is open beside an active loudspeaker, and firing on the
        // residue echo cancellation leaves behind would cut the advisor off
        // mid-sentence on every reply — see `lib/vad`.
        monitoring ? BARGE_IN_VAD_CONFIG : vadConfigRef.current
      );
      vadStateRef.current = next;
      setVadPhase((prev) => (prev === next.phase ? prev : next.phase));

      if (monitoring) {
        // Keep the buffer bounded while nobody is saying anything.
        //
        // The microphone records for the whole reply so the customer's opening
        // words are already captured when they cut in — but a reply that runs
        // for a minute would otherwise leave a minute of audio in memory, and
        // send all of it for transcription. Recycled only while the level is
        // below the bar, so a recording is never cut off mid-onset.
        if (next.phase === "LISTENING") {
          monitorAgeRef.current += VAD_SAMPLE_MS;
          if (monitorAgeRef.current >= MONITOR_RECYCLE_MS) {
            monitorAgeRef.current = 0;
            voiceRef.current.discardRecording();
          }
        } else {
          monitorAgeRef.current = 0;
        }

        // Fires on confirmed speech, not on the silence after it. You stop
        // talking when somebody starts, not when they finish — waiting for
        // `SUBMITTING` would leave the advisor talking over the whole
        // interruption and only notice once it was over.
        if (next.phase !== "SPEAKING") return;
        vadStateRef.current = idleVadState();
        bargeInRunRef.current();
        return;
      }

      if (next.phase !== "SUBMITTING") return;

      // Server transcription: the room going quiet ends the *recording*, not
      // the turn. The audio is flushed and the turn stays `LISTENING` until
      // words come back — see `runTranscription`.
      if (serverTranscriptionRef.current) {
        if (endOfTurnRef.current) return;
        endIntentRef.current = "vad";
        endOfTurnRef.current = true;
        setEndOfTurn(true);
        voiceRef.current.flushRecording();
        return;
      }

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
  }, [vadEnabled, turnState, endOfTurn, bargeIn, transcription]);

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
  // `PROCESSING` that will never resolve. A dropped connection is not the
  // mic's fault and usually clears on its own, so this recovers automatically
  // rather than leaving a bare `ERROR` behind — the same treatment a flaky STT
  // call gets.
  const streamPhase = stream?.phase;
  const streamError = stream?.error;
  useEffect(() => {
    if (streamPhase !== "error") return;
    if (stateRef.current !== "PROCESSING") return;
    attemptRecovery(streamError ?? "The advisor could not answer just now. Please try again.");
  }, [streamPhase, streamError, attemptRecovery]);

  // The turn checkpoint: which turn's reply the customer actually received.
  // Read off the stream's own `done` signal rather than any local guess, so a
  // caller recovering after a reload can tell a delivered turn apart from one
  // that merely stopped being in flight. Guarded to a spoken turn, mirroring
  // `finishStreamedTurn`'s own guard — a typed message's `done` says nothing
  // about the voice session.
  useEffect(() => {
    if (streamPhase !== "done") return;
    if (stateRef.current !== "PROCESSING" && stateRef.current !== "SPEAKING") return;
    lastCompletedTurnRef.current = turnIdRef.current;
    setLastCompletedTurn(turnIdRef.current);
  }, [streamPhase]);

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
      // In server mode there is no interim transcript — the words only exist
      // once the provider answers — so what is surfaced is the last thing it
      // heard. In browser mode this is the recogniser's live text, unchanged.
      transcript: serverTranscription ? sttTranscript : voice.transcript,
      error,
      volume: voice.volume,
      vadPhase,
      isListening: turnState === "LISTENING",
      isSpeaking: turnState === "SPEAKING",
      isBusy: turnState === "PROCESSING",
      isTranscribing: endOfTurn,
      detectedLanguage,
      lastRejected,
      can,
      firstAudioAt,
      voiceContext,
      speakingStyle,
      turnId,
      wasInterrupted,
      isRecovering: turnState === "RECOVERING",
      session: {
        sessionId,
        conversationId: sessionId,
        turnId,
        userId,
        currentAgent: { name: agent?.name ?? null, domain: agent?.domain ?? null },
        language,
        voiceState: turnState,
        lastCompletedTurn,
        activeGenerationId: turnId,
      },
      startListening,
      stopListening,
      endTurn,
      submitTurn,
      startSpeaking,
      pushStreamedText,
      finishStreamedTurn,
      replaceStreamedText,
      stopSpeaking,
      interrupt,
      interruptAndListen,
      reset,
    }),
    [
      turnState,
      voice.voiceState,
      voice.transcript,
      voice.volume,
      vadPhase,
      endOfTurn,
      detectedLanguage,
      serverTranscription,
      sttTranscript,
      error,
      lastRejected,
      can,
      firstAudioAt,
      voiceContext,
      speakingStyle,
      turnId,
      wasInterrupted,
      sessionId,
      userId,
      agent?.name,
      agent?.domain,
      language,
      lastCompletedTurn,
      startListening,
      stopListening,
      endTurn,
      submitTurn,
      startSpeaking,
      pushStreamedText,
      finishStreamedTurn,
      replaceStreamedText,
      stopSpeaking,
      interrupt,
      interruptAndListen,
      reset,
    ]
  );
}
