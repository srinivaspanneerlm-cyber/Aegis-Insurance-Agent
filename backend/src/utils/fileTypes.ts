/**
 * The formats Aegis accepts, in one place.
 *
 * Extension, declared MIME and real magic bytes used to be described in two
 * files that could drift apart — the multer filter knew the extensions, the
 * scanner knew the signatures, and nothing checked that a `.pdf` actually held
 * a PDF rather than some other permitted format. They are consolidated here so
 * a format is added once and every gate learns about it together.
 *
 * Customers upload photos of paperwork from phones, so HEIC and WEBP matter as
 * much as PDF; motor claims arrive as walkaround videos, so MP4/MOV do too.
 */

/** A run of bytes that must appear at a fixed offset. */
export interface SignaturePart {
  offset: number;
  bytes: readonly number[];
}

export interface FileFormat {
  id: string;
  extensions: readonly string[];
  /** Declared MIME types a browser plausibly sends for this format. */
  mimes: readonly string[];
  /** The format matches when every part of any one variant is present. */
  variants: readonly (readonly SignaturePart[])[];
}

/** Bytes of an ASCII marker, e.g. `ascii("ftyp")`. */
const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** ISO base-media files (HEIC, MP4, MOV) all carry `ftyp` at offset 4 and
 *  differ only by the brand that follows it. */
const isoBrand = (brand: string): SignaturePart[] => [
  { offset: 4, bytes: ascii("ftyp") },
  { offset: 8, bytes: ascii(brand) },
];

export const FILE_FORMATS: readonly FileFormat[] = [
  {
    id: "pdf",
    extensions: [".pdf"],
    mimes: ["application/pdf"],
    variants: [[{ offset: 0, bytes: ascii("%PDF-") }]],
  },
  {
    id: "docx",
    extensions: [".docx"],
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    // OOXML is a zip; Word writes a normal local-file header.
    variants: [[{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }]],
  },
  {
    id: "png",
    extensions: [".png"],
    mimes: ["image/png"],
    variants: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  },
  {
    id: "jpeg",
    extensions: [".jpg", ".jpeg"],
    mimes: ["image/jpeg"],
    variants: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  {
    id: "webp",
    extensions: [".webp"],
    mimes: ["image/webp"],
    variants: [[{ offset: 0, bytes: ascii("RIFF") }, { offset: 8, bytes: ascii("WEBP") }]],
  },
  {
    id: "heic",
    extensions: [".heic", ".heif"],
    mimes: ["image/heic", "image/heif"],
    variants: [
      isoBrand("heic"),
      isoBrand("heix"),
      isoBrand("hevc"),
      isoBrand("mif1"),
      isoBrand("msf1"),
    ],
  },
  {
    id: "mp4",
    extensions: [".mp4", ".m4v"],
    mimes: ["video/mp4"],
    variants: [
      isoBrand("isom"),
      isoBrand("iso2"),
      isoBrand("mp41"),
      isoBrand("mp42"),
      isoBrand("avc1"),
      isoBrand("dash"),
      isoBrand("M4V "),
    ],
  },
  {
    id: "mov",
    extensions: [".mov"],
    mimes: ["video/quicktime"],
    variants: [isoBrand("qt  ")],
  },
];

/** Enough bytes to cover the deepest signature part (`ftyp` brand at 8..12). */
export const HEAD_BYTES = 16;

export const ALLOWED_EXTENSIONS: readonly string[] = FILE_FORMATS.flatMap((f) => f.extensions);

/**
 * Declared MIME types the multer filter tolerates.
 *
 * `application/octet-stream` and an empty string are included because browsers
 * routinely send them for DOCX and HEIC. That is safe here only because the
 * declared type is never the real check — {@link detectFormat} reads the bytes.
 */
export const ALLOWED_MIMES: ReadonlySet<string> = new Set([
  ...FILE_FORMATS.flatMap((f) => f.mimes),
  "application/octet-stream",
  "",
]);

/** The file's extension, lowercased, including the dot ("" when it has none). */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

const matchesVariant = (head: Buffer, variant: readonly SignaturePart[]): boolean =>
  variant.every((part) => part.bytes.every((byte, i) => head[part.offset + i] === byte));

/** Which format these leading bytes actually are, or null for none of them. */
export function detectFormat(head: Buffer): FileFormat | null {
  return FILE_FORMATS.find((f) => f.variants.some((v) => matchesVariant(head, v))) ?? null;
}

/** Does a filename's extension belong to the format its bytes say it is? */
export function extensionMatchesFormat(filename: string, format: FileFormat): boolean {
  return format.extensions.includes(extensionOf(filename));
}
