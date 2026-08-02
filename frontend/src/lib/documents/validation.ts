import type { DocumentRequirement, LocalisedText } from "@/types/documents";
import { ACCEPT_ANY, EXTENSIONS, MAX_UPLOAD_BYTES } from "./registry";

/**
 * Client-side upload validation.
 *
 * This is a courtesy check that fails fast and explains itself in the
 * customer's language — it is *not* a security boundary. The server re-validates
 * every upload and inspects the real magic bytes, because everything here can
 * be bypassed by anyone talking to the API directly.
 */

export type RejectionCode = "empty" | "type" | "size";

export interface FileRejection {
  code: RejectionCode;
  message: LocalisedText;
}

/** Just the shape needed for validation, so tests need no real `File`. */
export interface ValidatableFile {
  name: string;
  size: number;
  type: string;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** The `accept` attribute for a native file picker: MIME types + extensions,
 *  because a browser that cannot type-sniff HEIC still matches on `.heic`. */
export function acceptAttribute(accept: string[] = ACCEPT_ANY): string {
  const exts = accept.flatMap((mime) => EXTENSIONS[mime] ?? []);
  return [...accept, ...new Set(exts)].join(",");
}

/**
 * "PDF, DOCX, PNG · up to 10 MB" — shown *before* the picker opens, so a limit
 * is something the customer knows rather than something they discover by being
 * rejected. `.jpeg` and `.heif` are folded away: they are the same format as
 * `.jpg` and `.heic`, and listing both twice just makes the line longer.
 */
export function describeAccept(accept: string[], maxBytes: number): string {
  const labels = [...new Set(accept.flatMap((m) => EXTENSIONS[m] ?? []))]
    .map((e) => e.replace(".", "").toUpperCase())
    .filter((e) => e !== "JPEG" && e !== "HEIF");

  return `${labels.join(", ")} · up to ${formatBytes(Math.min(maxBytes, MAX_UPLOAD_BYTES))}`;
}

/**
 * Does the file's type sit inside the accepted set? The reported MIME type is
 * unreliable — browsers send an empty string or `application/octet-stream` for
 * HEIC and DOCX — so an unusable type falls back to the extension.
 */
export function isAcceptedType(file: ValidatableFile, accept: string[]): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime && mime !== "application/octet-stream" && accept.includes(mime)) return true;

  const ext = extensionOf(file.name);
  return ext !== "" && accept.some((m) => (EXTENSIONS[m] ?? []).includes(ext));
}

/** Null when the file is fine; otherwise why it was turned away. */
export function validateFile(
  file: ValidatableFile,
  requirement?: Pick<DocumentRequirement, "accept" | "maxBytes" | "label">,
): FileRejection | null {
  const accept = requirement?.accept ?? ACCEPT_ANY;
  const maxBytes = Math.min(requirement?.maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);

  if (file.size <= 0) {
    return {
      code: "empty",
      message: {
        en: `"${file.name}" is empty — please pick the file again.`,
        taEn: `"${file.name}" empty-ah iruku — file-a marubadiyum select pannunga.`,
      },
    };
  }

  if (!isAcceptedType(file, accept)) {
    const allowed = [...new Set(accept.flatMap((m) => EXTENSIONS[m] ?? []))]
      .map((e) => e.replace(".", "").toUpperCase())
      .join(", ");
    return {
      code: "type",
      message: {
        en: `"${file.name}" is not a supported format. Accepted: ${allowed}.`,
        taEn: `"${file.name}" support aagala. Accepted: ${allowed}.`,
      },
    };
  }

  if (file.size > maxBytes) {
    return {
      code: "size",
      message: {
        en: `"${file.name}" is ${formatBytes(file.size)} — the limit is ${formatBytes(maxBytes)}.`,
        taEn: `"${file.name}" ${formatBytes(file.size)} iruku — limit ${formatBytes(maxBytes)}.`,
      },
    };
  }

  return null;
}
