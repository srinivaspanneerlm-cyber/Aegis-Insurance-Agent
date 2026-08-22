/**
 * Which container each browser actually gets.
 *
 * This is the file that decides whether voice works outside Chrome, so the
 * cases are written as browsers rather than as inputs: the bug this replaces
 * was not "the wrong MIME was chosen", it was "Safari users had no voice at
 * all". Each test names the browser it stands for.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_RECORDING_BYTES,
  MIN_RECORDING_BYTES,
  RECORDING_CANDIDATES,
  baseMimeType,
  isTooLargeToUpload,
  isTooShortToTranscribe,
  pickRecordingMimeType,
  recordingFilename,
} from "./audioCapture";

/** A browser that supports exactly the types it is given, and nothing else. */
const supporting = (...supported: string[]) => (mime: string) => supported.includes(mime);

describe("pickRecordingMimeType", () => {
  it("gives Chrome, Edge and Brave Opus in WebM", () => {
    const chrome = supporting("audio/webm;codecs=opus", "audio/webm");
    expect(pickRecordingMimeType(chrome)).toBe("audio/webm;codecs=opus");
  });

  it("gives Firefox Opus, whichever container it offers", () => {
    const firefox = supporting("audio/ogg;codecs=opus", "audio/ogg");
    expect(pickRecordingMimeType(firefox)).toBe("audio/ogg;codecs=opus");
  });

  it("gives Safari MP4 — the one thing it can record", () => {
    // Safari supports no Opus at all. If this ever returns a WebM type,
    // recording throws there and iPhone users lose voice entirely.
    const safari = supporting("audio/mp4");
    expect(pickRecordingMimeType(safari)).toBe("audio/mp4");
  });

  it("falls back to the browser's own default rather than giving up", () => {
    // A browser that recognises none of our names still records something, and
    // `recorder.mimeType` afterwards says what. Returning "" is how we ask.
    expect(pickRecordingMimeType(() => false)).toBe("");
  });

  it("treats a browser that throws on an unfamiliar type as saying no", () => {
    // Some builds throw on an unexpected parameter list instead of returning
    // false. That must not become an exception in the mic path.
    const thrower = (mime: string) => {
      if (mime.includes(";")) throw new TypeError("bad parameter");
      return mime === "audio/webm";
    };
    expect(pickRecordingMimeType(thrower)).toBe("audio/webm");
  });

  it("returns null only when there is no MediaRecorder to ask", () => {
    expect(pickRecordingMimeType(null)).toBeNull();
    expect(pickRecordingMimeType(undefined)).toBeNull();
  });

  it("prefers Opus over AAC wherever both are available", () => {
    // Bitrate is the point: on a rural connection the smaller upload is the
    // difference between a turn that lands and one that times out.
    const both = supporting("audio/webm;codecs=opus", "audio/mp4");
    expect(pickRecordingMimeType(both)).toBe("audio/webm;codecs=opus");
    expect(RECORDING_CANDIDATES.indexOf("audio/webm;codecs=opus")).toBeLessThan(
      RECORDING_CANDIDATES.indexOf("audio/mp4")
    );
  });
});

describe("baseMimeType", () => {
  it("strips the codec parameter the server does not match on", () => {
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
  });

  it("normalises case and whitespace so a lookup cannot miss", () => {
    expect(baseMimeType("  AUDIO/WEBM ; codecs=opus")).toBe("audio/webm");
  });

  it("survives a recorder that reports nothing", () => {
    expect(baseMimeType(undefined)).toBe("");
    expect(baseMimeType(null)).toBe("");
  });
});

describe("size guards", () => {
  it("refuses a recording that is only a container header", () => {
    // The real cost of letting this through is not bandwidth: a model handed a
    // second of room noise invents a plausible sentence, which becomes a real
    // turn in the customer's conversation memory.
    expect(isTooShortToTranscribe(0)).toBe(true);
    expect(isTooShortToTranscribe(MIN_RECORDING_BYTES - 1)).toBe(true);
    expect(isTooShortToTranscribe(MIN_RECORDING_BYTES)).toBe(false);
  });

  it("refuses an oversized recording before the upload, not after", () => {
    expect(isTooLargeToUpload(MAX_RECORDING_BYTES + 1)).toBe(true);
    expect(isTooLargeToUpload(MAX_RECORDING_BYTES)).toBe(false);
  });
});

describe("recordingFilename", () => {
  it("names the part after the container it actually holds", () => {
    expect(recordingFilename("audio/webm;codecs=opus")).toBe("turn.webm");
    expect(recordingFilename("audio/ogg")).toBe("turn.ogg");
    expect(recordingFilename("audio/mp4")).toBe("turn.mp4");
    expect(recordingFilename("audio/wav")).toBe("turn.wav");
  });

  it("still produces a name for a container it does not know", () => {
    expect(recordingFilename("audio/weird")).toBe("turn.bin");
  });
});
