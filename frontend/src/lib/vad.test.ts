/**
 * When a spoken turn starts, and — the part that actually matters — when it ends.
 *
 * These assertions stand in for a room: someone pausing to think mid-sentence, a
 * door closing, a fan running, a customer who tapped the mic and said nothing.
 * Each one used to be handled by Chrome's endpointer, which we could neither see
 * nor configure, and which is absent from every browser this product is moving
 * towards.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_VAD_CONFIG,
  MIN_SPEECH_MS,
  SILENCE_TIMEOUT_MS,
  VAD_END_THRESHOLD,
  VAD_SAMPLE_MS,
  VAD_START_THRESHOLD,
  armVad,
  idleVadState,
  isEndOfTurn,
  resolveVadConfig,
  stepVad,
  type VadConfig,
  type VadState,
} from "./vad";

const QUIET = 0.02;               // an empty room on this signal
const SPEECH = 0.35;              // ordinary talking
const MURMUR = 0.14;              // between the two thresholds

/** Hold `volume` for `ms`, one sample at a time, as the real loop does. */
function hold(state: VadState, volume: number, ms: number, config: VadConfig = DEFAULT_VAD_CONFIG): VadState {
  let s = state;
  for (let t = 0; t < ms; t += VAD_SAMPLE_MS) {
    s = stepVad(s, volume, VAD_SAMPLE_MS, config);
  }
  return s;
}

describe("thresholds", () => {
  it("needs more to start a turn than to keep one going", () => {
    // Without this gap a speaker sitting at the boundary flickers several times
    // a second, and every flicker restarts the silence clock.
    expect(VAD_START_THRESHOLD).toBeGreaterThan(VAD_END_THRESHOLD);
  });

  it("refuses an override that inverts the hysteresis", () => {
    const c = resolveVadConfig({ startThreshold: 0.2, endThreshold: 0.5 });
    expect(c.endThreshold).toBeLessThan(c.startThreshold);
  });

  it("ignores an override that is not actually set", () => {
    // Reading an absent field off a caller's options yields `undefined`, and a
    // plain spread would write that straight over the default.
    const c = resolveVadConfig({ startThreshold: undefined, minSpeechMs: Number.NaN });
    expect(c.startThreshold).toBe(VAD_START_THRESHOLD);
    expect(c.minSpeechMs).toBe(MIN_SPEECH_MS);
  });

  it("keeps the caller's own thresholds when they are sane", () => {
    const c = resolveVadConfig({ startThreshold: 0.3, endThreshold: 0.12, minSpeechMs: 900 });
    expect(c.startThreshold).toBe(0.3);
    expect(c.endThreshold).toBe(0.12);
    expect(c.minSpeechMs).toBe(900);
    expect(c.silenceTimeoutMs).toBe(SILENCE_TIMEOUT_MS); // untouched default
  });
});

describe("speech start", () => {
  it("does nothing in a quiet room", () => {
    const s = hold(armVad(), QUIET, 5000);
    expect(s.phase).toBe("LISTENING");
    expect(s.speechMs).toBe(0);
  });

  it("starts a turn once speech holds past the debounce", () => {
    const s = hold(armVad(), SPEECH, 300);
    expect(s.phase).toBe("SPEAKING");
    expect(s.speechMs).toBeGreaterThan(0);
  });

  it("does not start on a sound too brief to be speech", () => {
    // A door, a key press, a cough — over the threshold, under the debounce.
    const s = stepVad(armVad(), SPEECH, 50);
    expect(s.phase).toBe("LISTENING");
  });

  it("does not let unrelated blips add up to an onset", () => {
    let s = armVad();
    for (let i = 0; i < 8; i++) {
      s = stepVad(s, SPEECH, 50);   // one loud sample…
      s = stepVad(s, QUIET, 50);    // …then quiet again
    }
    expect(s.phase).toBe("LISTENING");
  });

  it("will not start on a murmur below the start threshold", () => {
    const s = hold(armVad(), MURMUR, 2000);
    expect(s.phase).toBe("LISTENING");
  });
});

describe("continuous speech", () => {
  it("stays in the turn through a long answer", () => {
    const s = hold(armVad(), SPEECH, 12_000);
    expect(s.phase).toBe("SPEAKING");
    expect(s.silenceMs).toBe(0);
    expect(s.speechMs).toBeGreaterThan(11_000);
  });

  it("survives a pause for breath without ending the turn", () => {
    // Someone working out how to describe their family stops for half a second.
    // The old endpointer cut them off here.
    let s = hold(armVad(), SPEECH, 1000);
    s = hold(s, QUIET, SILENCE_TIMEOUT_MS - 400);
    expect(s.phase).toBe("SILENCE");
    s = hold(s, SPEECH, 600);
    expect(s.phase).toBe("SPEAKING");
    expect(s.silenceMs).toBe(0);
  });

  it("keeps going on the quieter sustain level alone", () => {
    // Trailing off at the end of a sentence must not read as stopping.
    let s = hold(armVad(), SPEECH, 800);
    s = hold(s, MURMUR, 3000);
    expect(s.phase).toBe("SPEAKING");
  });
});

describe("end of turn", () => {
  it("ends only after the silence has held", () => {
    let s = hold(armVad(), SPEECH, 1500);
    s = hold(s, QUIET, SILENCE_TIMEOUT_MS - 200);
    expect(s.phase).toBe("SILENCE");
    expect(isEndOfTurn(s)).toBe(false);

    s = hold(s, QUIET, 400);
    expect(s.phase).toBe("SUBMITTING");
    expect(isEndOfTurn(s)).toBe(true);
  });

  it("stays put once the turn is over", () => {
    // The caller reads the verdict and re-arms; stepping again must not quietly
    // restart a turn that has already been submitted.
    let s = hold(armVad(), SPEECH, 1500);
    s = hold(s, QUIET, SILENCE_TIMEOUT_MS + 200);
    expect(s.phase).toBe("SUBMITTING");
    expect(hold(s, SPEECH, 2000).phase).toBe("SUBMITTING");
  });

  it("honours a shorter silence timeout", () => {
    const quick = resolveVadConfig({ silenceTimeoutMs: 400 });
    let s = hold(armVad(), SPEECH, 1000, quick);
    s = hold(s, QUIET, 500, quick);
    expect(s.phase).toBe("SUBMITTING");
  });
});

describe("noise rejection", () => {
  it("throws away a burst too short to be a turn", () => {
    // Loud enough to start, nowhere near long enough to mean anything.
    let s = hold(armVad(), SPEECH, 200);
    expect(s.phase).toBe("SPEAKING");
    expect(s.speechMs).toBeLessThan(MIN_SPEECH_MS);

    s = hold(s, QUIET, SILENCE_TIMEOUT_MS + 100);
    expect(s.phase).toBe("LISTENING");   // not SUBMITTING
    expect(isEndOfTurn(s)).toBe(false);
  });

  it("re-arms cleanly after rejecting noise", () => {
    let s = hold(armVad(), SPEECH, 200);
    s = hold(s, QUIET, SILENCE_TIMEOUT_MS + 100);
    expect(s).toEqual(armVad());

    // …and a real turn straight afterwards is still recognised.
    s = hold(s, SPEECH, 1500);
    s = hold(s, QUIET, SILENCE_TIMEOUT_MS + 100);
    expect(s.phase).toBe("SUBMITTING");
  });

  it("never submits a turn from a room that only ever murmured", () => {
    const s = hold(armVad(), MURMUR, 20_000);
    expect(s.phase).toBe("LISTENING");
  });

  it("rejects a rattling burst that repeats but never sustains", () => {
    let s = armVad();
    for (let i = 0; i < 20; i++) {
      s = hold(s, SPEECH, 200);
      s = hold(s, QUIET, SILENCE_TIMEOUT_MS + 100);
      expect(s.phase).toBe("LISTENING");
    }
  });
});

describe("guards", () => {
  it("ignores an idle machine until it is armed", () => {
    expect(hold(idleVadState(), SPEECH, 5000).phase).toBe("IDLE");
  });

  it("treats a broken level reading as silence rather than speech", () => {
    // The analyser is wrapped in a try/catch and can leave `volume` unset; a
    // NaN must never be read as somebody talking.
    const s = hold(armVad(), Number.NaN, 3000);
    expect(s.phase).toBe("LISTENING");
  });

  it("does not run the clock backwards on a negative delta", () => {
    const s = stepVad(armVad(), SPEECH, -500);
    expect(s.onsetMs).toBe(0);
  });

  it("only ever reports a real phase", () => {
    const phases = new Set(["IDLE", "LISTENING", "SPEAKING", "SILENCE", "SUBMITTING"]);
    let s = armVad();
    for (const v of [QUIET, SPEECH, MURMUR, SPEECH, QUIET, QUIET, QUIET]) {
      s = hold(s, v, 700);
      expect(phases.has(s.phase)).toBe(true);
    }
  });
});
