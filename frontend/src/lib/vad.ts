/**
 * Voice activity detection — when a spoken turn starts and, harder, when it ends.
 *
 * Until now the browser decided that for us: `SpeechRecognition` runs with
 * `continuous = false` and closes the utterance whenever Chrome's own endpointer
 * says so. That endpointer is opaque, unconfigurable, and not present in any
 * browser we are moving towards, so nothing built on it survives the move to
 * server-side transcription. It also fails the people this product is for: it is
 * tuned for short commands, and a first-time buyer working out how to describe
 * their family pauses mid-sentence and gets cut off.
 *
 * So end-of-turn is decided here instead, from the microphone level the waveform
 * already computes, with two rules that matter more than the thresholds:
 *
 *   Hysteresis — it takes a louder sound to *start* a turn than to *continue*
 *   one (`startThreshold` > `endThreshold`). One threshold for both makes a
 *   speaker at the boundary flicker between speaking and silent several times a
 *   second, and every flicker resets the silence clock.
 *
 *   A floor on speech — a turn is only submitted if enough real speech was
 *   heard (`minSpeechMs`). A door closing clears the start threshold easily;
 *   it does not clear it for a third of a second. Without this, a noisy room
 *   sends empty turns to the orchestrator, each one a paid LLM call and a line
 *   of nonsense in the customer's conversation memory.
 *
 * Deliberately pure and clock-free: it is handed a level and how much time has
 * passed, and returns the next state. Nothing here knows about React, the
 * microphone, or which transcription service will eventually receive the audio,
 * so the same machine works unchanged when transcription moves to the server.
 */

/**
 * `IDLE`       — not armed; the microphone is closed.
 * `LISTENING`  — armed, waiting for speech to begin.
 * `SPEAKING`   — the **customer** is talking. Note this is not the voice
 *                runtime's `SPEAKING`, which means the advisor is talking; the
 *                two are separate types so they cannot be confused.
 * `SILENCE`    — they were talking and have stopped, but not yet for long
 *                enough to call it the end of the turn.
 * `SUBMITTING` — stable silence after real speech. The turn is over.
 */
export type VadPhase = "IDLE" | "LISTENING" | "SPEAKING" | "SILENCE" | "SUBMITTING";

export interface VadConfig {
  /** Level (0–1) that must be exceeded to *begin* a turn. */
  startThreshold: number;
  /** Lower level that merely *sustains* one. Below this, silence accrues. */
  endThreshold: number;
  /** How long that silence must hold before the turn is considered over. */
  silenceTimeoutMs: number;
  /** How much speech a turn needs before it is worth submitting at all. */
  minSpeechMs: number;
  /** How long the start threshold must be held before speech is believed. */
  startDebounceMs: number;
}

/**
 * Starting points, not settled values.
 *
 * They are expressed against the existing waveform signal — a byte FFT mean
 * scaled by 90 and clamped to 1 — where a quiet room sits near 0.02 and ordinary
 * speech runs about 0.15–0.6. They still need tuning against real microphones in
 * real rooms; a laptop's built-in array and a phone held at arm's length do not
 * produce the same numbers.
 */
export const VAD_START_THRESHOLD = 0.18;
export const VAD_END_THRESHOLD = 0.1;
export const SILENCE_TIMEOUT_MS = 1200;
export const MIN_SPEECH_MS = 400;
export const START_DEBOUNCE_MS = 120;

/** How often the level is sampled. Fine enough for the timings above. */
export const VAD_SAMPLE_MS = 50;

// ── Barge-in ──────────────────────────────────────────────────────────────────
//
// Detecting that the customer has started talking *while the advisor is
// talking* is a different problem from detecting the end of their turn, and it
// wants different numbers.
//
// The microphone is open beside an active loudspeaker, so the browser's echo
// cancellation is doing the heavy lifting — it removes most of what Aegis is
// saying from what the microphone hears, but not all of it, and how much
// residue is left depends on the room, the volume and whether the customer is
// on speakerphone. That residue is the thing these thresholds have to sit
// above.
//
// The cost of the two mistakes is asymmetric, and that is what sets the
// direction. Missing a real interruption is annoying: the customer says
// "wait" and repeats themselves a second later. Firing on residue is much
// worse — the advisor cuts itself off mid-sentence for no reason, which is
// indistinguishable from a broken product and happens on *every* reply.
//
// So barge-in asks for more evidence than an ordinary turn does: a louder
// sound, held for longer. A cough, a door, or a syllable of Aegis's own voice
// leaking through does not clear both bars.

/** Louder than the level that merely starts an ordinary turn. */
export const BARGE_IN_START_THRESHOLD = 0.3;

/** ...and held for this long before it is believed. Two and a half samples. */
export const BARGE_IN_DEBOUNCE_MS = 300;

/**
 * How much real speech barge-in needs before it counts.
 *
 * Shorter than a normal turn's `minSpeechMs`, because the trigger is different:
 * an ordinary turn is submitted after the customer *stops*, so it can afford to
 * wait and see. Barge-in has to act while they are still speaking, and by the
 * time this has elapsed they are already a word in.
 */
export const BARGE_IN_MIN_SPEECH_MS = 250;

/**
 * The profile used while the advisor is speaking or thinking.
 *
 * Deliberately the same state machine as an ordinary turn — hysteresis, an
 * onset debounce, a floor on real speech — with the bars raised. A second
 * detector would be a second thing to tune and a second thing to get wrong.
 */
export const BARGE_IN_VAD_CONFIG: VadConfig = {
  startThreshold: BARGE_IN_START_THRESHOLD,
  endThreshold: BARGE_IN_START_THRESHOLD * 0.7,
  silenceTimeoutMs: SILENCE_TIMEOUT_MS,
  minSpeechMs: BARGE_IN_MIN_SPEECH_MS,
  startDebounceMs: BARGE_IN_DEBOUNCE_MS,
};

export const DEFAULT_VAD_CONFIG: VadConfig = {
  startThreshold: VAD_START_THRESHOLD,
  endThreshold: VAD_END_THRESHOLD,
  silenceTimeoutMs: SILENCE_TIMEOUT_MS,
  minSpeechMs: MIN_SPEECH_MS,
  startDebounceMs: START_DEBOUNCE_MS,
};

/**
 * Fill in whatever the caller left out.
 *
 * `endThreshold` is clamped below `startThreshold`: an override that inverts
 * them removes the hysteresis silently, and the symptom — turns ending
 * mid-sentence in noisy rooms only — would be blamed on the microphone.
 */
export function resolveVadConfig(overrides?: Partial<VadConfig>): VadConfig {
  const merged = { ...DEFAULT_VAD_CONFIG };
  // Assigned key by key rather than spread, so an override object carrying an
  // explicit `undefined` — which is what reading an absent field off a caller's
  // options produces — falls back to the default instead of erasing it.
  for (const key of Object.keys(merged) as (keyof VadConfig)[]) {
    const value = overrides?.[key];
    if (typeof value === "number" && Number.isFinite(value)) merged[key] = value;
  }
  return {
    ...merged,
    endThreshold: Math.min(merged.endThreshold, merged.startThreshold * 0.95),
  };
}

export interface VadState {
  phase: VadPhase;
  /** Speech heard this turn. Checked against `minSpeechMs` before submitting. */
  speechMs: number;
  /** Unbroken quiet since speech last stopped. */
  silenceMs: number;
  /** Time spent above the start threshold, before speech is believed. */
  onsetMs: number;
}

const CLEARED = { speechMs: 0, silenceMs: 0, onsetMs: 0 } as const;

/** Not armed. */
export function idleVadState(): VadState {
  return { phase: "IDLE", ...CLEARED };
}

/** Armed and waiting for the customer to start. */
export function armVad(): VadState {
  return { phase: "LISTENING", ...CLEARED };
}

/**
 * Advance the machine by one sample.
 *
 * @param state  where the turn stood.
 * @param volume microphone level, 0–1, from the existing waveform analyser.
 * @param dtMs   milliseconds since the previous sample.
 */
export function stepVad(
  state: VadState,
  volume: number,
  dtMs: number,
  config: VadConfig = DEFAULT_VAD_CONFIG
): VadState {
  // `IDLE` needs arming and `SUBMITTING` is terminal — the caller reads the
  // verdict and re-arms. Stepping either would quietly restart a finished turn.
  if (state.phase === "IDLE" || state.phase === "SUBMITTING") return state;

  const level = Number.isFinite(volume) ? volume : 0;
  const dt = Math.max(0, dtMs);

  if (state.phase === "LISTENING") {
    if (level < config.startThreshold) {
      // A blip that did not hold. Forget it rather than letting a series of
      // unrelated clicks add up to an onset.
      return state.onsetMs === 0 ? state : { ...state, onsetMs: 0 };
    }
    const onsetMs = state.onsetMs + dt;
    if (onsetMs < config.startDebounceMs) return { ...state, onsetMs };
    // The debounce window was real speech too, so it counts toward the floor.
    return { phase: "SPEAKING", speechMs: onsetMs, silenceMs: 0, onsetMs: 0 };
  }

  // SPEAKING or SILENCE. Continuing only needs the lower threshold, so an
  // ordinary pause for breath does not read as the end of the turn.
  if (level >= config.endThreshold) {
    return { phase: "SPEAKING", speechMs: state.speechMs + dt, silenceMs: 0, onsetMs: 0 };
  }

  const silenceMs = state.silenceMs + dt;
  if (silenceMs < config.silenceTimeoutMs) {
    return { phase: "SILENCE", speechMs: state.speechMs, silenceMs, onsetMs: 0 };
  }

  // Quiet has held. Was there ever a turn here?
  if (state.speechMs >= config.minSpeechMs) {
    return { phase: "SUBMITTING", speechMs: state.speechMs, silenceMs, onsetMs: 0 };
  }
  // Noise, not speech. Drop it and keep listening — the customer is not told
  // anything, because from their side nothing happened.
  return armVad();
}

/** Whether this state means the turn is over and should be sent. */
export function isEndOfTurn(state: VadState): boolean {
  return state.phase === "SUBMITTING";
}
