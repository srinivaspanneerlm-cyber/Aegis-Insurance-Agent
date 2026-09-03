/**
 * Recording a voice turn in a browser that will not agree with the next one.
 *
 * The old path asked `webkitSpeechRecognition` to both listen and transcribe,
 * which meant voice worked in Chrome and Edge and nowhere else — Firefox and
 * Safari ship no recogniser, and Brave ships one that always fails because it
 * removed Google's key on purpose. `MediaRecorder` is the thing they *do* all
 * have, so the browser's job shrinks to capturing audio and the transcription
 * moves to the server, where one provider serves every browser identically.
 *
 * What they still disagree on is the container:
 *
 *   Chrome, Edge, Brave   WebM with Opus
 *   Firefox               WebM or Ogg, Opus either way
 *   Safari (macOS, iOS)   MP4/AAC — it supports no Opus at all
 *
 * So nothing is hardcoded. The candidates are tried in order against the
 * browser's own `isTypeSupported`, most-preferred first, and whatever it admits
 * to is what gets recorded and what the server is told it received. No
 * transcoding anywhere: it would mean shipping a codec to the browser or
 * ffmpeg to the server, to arrive at audio the provider already accepted.
 *
 * Kept pure and DOM-free so the choice can be tested for every browser without
 * one — `isTypeSupported` is passed in rather than reached for.
 */

/**
 * Ordered by preference, not by popularity.
 *
 * Opus first because it is the only codec here designed for speech: at the
 * bitrates MediaRecorder picks it carries a spoken sentence in a fraction of
 * the bytes AAC needs, which on a rural connection is the difference between a
 * turn that uploads and one that times out. MP4/AAC exists in this list for
 * exactly one reason — Safari, which has no Opus and would otherwise be back
 * where SpeechRecognition left it.
 *
 * The empty string is last and is not a MIME type: it tells MediaRecorder to
 * pick its own default. A browser that recognises none of the names above still
 * records something, and `recorder.mimeType` afterwards says what.
 */
export const RECORDING_CANDIDATES: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "",
];

/** `audio/webm;codecs=opus` → `audio/webm`. The server matches on the container. */
export function baseMimeType(mime: string | undefined | null): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * A recording shorter than this is a container header and no speech.
 *
 * It is checked before upload rather than after, because the cost of being
 * wrong is asymmetric: an empty turn that reaches the server buys a paid
 * transcription call to be told there was nothing in it, and — worse — a model
 * handed a second of room noise will sometimes invent a plausible sentence,
 * which then becomes a real turn in the customer's conversation memory.
 *
 * Sized against the smallest thing worth sending: roughly a quarter-second of
 * Opus plus its header. Deliberately generous downward — a genuinely short
 * "yes" must still get through, and the server checks again anyway.
 */
export const MIN_RECORDING_BYTES = 1200;

/** The most the browser will upload. Mirrors the server's cap so the refusal
 *  happens here, where it costs nothing, rather than after a slow upload. */
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024;

/**
 * How often MediaRecorder hands over a chunk, in ms.
 *
 * A timeslice is passed at all so that data exists *before* `stop()` — without
 * one, a recorder stopped mid-turn can deliver a single blob late or, on some
 * WebKit builds, not at all. Quarter-second keeps the buffer small without
 * making a chunk callback a per-frame cost.
 */
export const RECORDING_TIMESLICE_MS = 250;

/**
 * The first candidate this browser admits to supporting, or `null` if it has no
 * MediaRecorder at all.
 *
 * `isTypeSupported` is injected rather than read off `window.MediaRecorder` so
 * every browser's answer can be tested from Node. The empty candidate always
 * matches, which is what guarantees a browser with MediaRecorder always gets a
 * usable answer — only its complete absence returns `null`.
 */
export function pickRecordingMimeType(
  isTypeSupported?: ((mime: string) => boolean) | null
): string | null {
  if (typeof isTypeSupported !== "function") {
    // No MediaRecorder to ask. A browser that has the constructor but not the
    // static method is old enough that its default is the only option, and the
    // caller handles a `null` by refusing to record rather than guessing.
    return null;
  }
  for (const candidate of RECORDING_CANDIDATES) {
    if (candidate === "") return "";
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      // Some builds throw on an unfamiliar parameter list rather than
      // returning false. Treated the same as "no".
    }
  }
  return "";
}

/** Whether this browser can record audio at all, independent of any recogniser. */
export function canRecordAudio(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const hasRecorder = typeof (window as { MediaRecorder?: unknown }).MediaRecorder === "function";
  const hasMic = typeof navigator.mediaDevices?.getUserMedia === "function";
  return hasRecorder && hasMic;
}

/** Too small to contain speech — send nothing and let the customer speak again. */
export function isTooShortToTranscribe(byteLength: number): boolean {
  return byteLength < MIN_RECORDING_BYTES;
}

/** Beyond what the server will accept. Refused before the upload, not after. */
export function isTooLargeToUpload(byteLength: number): boolean {
  return byteLength > MAX_RECORDING_BYTES;
}

/** A filename for the upload field. Not stored anywhere — multipart wants one. */
export function recordingFilename(mime: string): string {
  const container = baseMimeType(mime);
  const extension =
    container === "audio/webm" ? "webm"
    : container === "audio/ogg" ? "ogg"
    : container === "audio/mp4" ? "mp4"
    : container === "audio/wav" || container === "audio/x-wav" ? "wav"
    : "bin";
  return `turn.${extension}`;
}
