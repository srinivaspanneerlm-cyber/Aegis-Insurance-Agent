/**
 * The recording formats Aegis accepts from a browser, and how to tell a real
 * one from a file that merely claims to be one.
 *
 * Deliberately separate from `utils/fileTypes`. That catalogue governs
 * *documents* — things a customer uploads to be stored, scanned and kept. A
 * voice turn is neither stored nor kept: it is held in memory, transcribed, and
 * dropped. Sharing one list would mean either letting a PDF into the
 * transcription path or letting an Opus stream into the document store, and
 * both are wrong.
 *
 * Four containers, because browsers do not agree and that disagreement is
 * exactly what this whole step exists to absorb:
 *
 *   Chrome / Edge / Brave   WebM, Opus inside
 *   Firefox                 Ogg or WebM, Opus inside
 *   Safari (macOS + iOS)    MP4/AAC — no Opus support at all, so nothing else
 *   Older Android WebViews   MP4, occasionally raw WAV
 *
 * A `Content-Type` is a claim, so the bytes are checked too. Not as a malware
 * scan — nothing here is executed or written to disk — but because a request
 * that labels a 5 MB zip as `audio/webm` otherwise buys a paid provider call to
 * be told it is not audio, and that is a cheap way to burn someone's quota.
 */

/** Bytes that must appear at a fixed offset for a container to be believed. */
interface AudioSignature {
  offset: number;
  bytes: readonly number[];
}

export interface AudioFormat {
  id: string;
  /** MIME types a browser plausibly reports for this container. */
  mimes: readonly string[];
  /** The format matches when every part of any one variant is present. */
  variants: readonly (readonly AudioSignature[])[];
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

export const AUDIO_FORMATS: readonly AudioFormat[] = [
  {
    // EBML header — the container WebM and Matroska share.
    id: "webm",
    mimes: ["audio/webm", "video/webm"],
    variants: [[{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }]],
  },
  {
    id: "ogg",
    mimes: ["audio/ogg", "application/ogg"],
    variants: [[{ offset: 0, bytes: ascii("OggS") }]],
  },
  {
    // ISO base media: `ftyp` at offset 4. The brand that follows varies by
    // encoder (`isom`, `mp42`, `M4A `), so only the marker is required —
    // pinning the brand would reject Safari's own output on a version bump.
    id: "mp4",
    mimes: ["audio/mp4", "audio/x-m4a", "audio/aac", "video/mp4"],
    variants: [[{ offset: 4, bytes: ascii("ftyp") }]],
  },
  {
    // RIFF....WAVE — the two markers with the size field between them.
    id: "wav",
    mimes: ["audio/wav", "audio/x-wav", "audio/wave"],
    variants: [
      [
        { offset: 0, bytes: ascii("RIFF") },
        { offset: 8, bytes: ascii("WAVE") },
      ],
    ],
  },
];

/** Every MIME the transcription path will accept, container parameters aside. */
export const ALLOWED_AUDIO_MIMES: ReadonlySet<string> = new Set(
  AUDIO_FORMATS.flatMap((f) => f.mimes)
);

/**
 * `audio/webm;codecs=opus` → `audio/webm`.
 *
 * MediaRecorder reports the codec next to the container and every browser
 * spaces the parameter list differently, so the comparison is made on the base
 * type alone.
 */
export function baseMimeType(mime: string | undefined | null): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

/** Whether the *declared* type is one we accept. Spoofable — see `sniffAudio`. */
export function isAllowedAudioMime(mime: string | undefined | null): boolean {
  return ALLOWED_AUDIO_MIMES.has(baseMimeType(mime));
}

function matches(buffer: Buffer, signature: AudioSignature): boolean {
  const end = signature.offset + signature.bytes.length;
  if (buffer.length < end) return false;
  return signature.bytes.every((b, i) => buffer[signature.offset + i] === b);
}

/** The container these bytes actually are, or `null` if it is none of them. */
export function sniffAudio(buffer: Buffer): string | null {
  for (const format of AUDIO_FORMATS) {
    for (const variant of format.variants) {
      if (variant.every((part) => matches(buffer, part))) return format.id;
    }
  }
  return null;
}

/**
 * Whether the bytes agree with the declared type.
 *
 * Both directions matter. Bytes that are not audio at all are refused outright.
 * Bytes that are audio but a *different* container are also refused, because
 * the declared type is what gets forwarded to the provider — sending Ogg bytes
 * labelled `audio/mp4` fails there instead, slower and less clearly.
 */
export function audioMatchesDeclaredType(buffer: Buffer, mime: string): boolean {
  const actual = sniffAudio(buffer);
  if (!actual) return false;
  const format = AUDIO_FORMATS.find((f) => f.id === actual);
  return format ? format.mimes.includes(baseMimeType(mime)) : false;
}
