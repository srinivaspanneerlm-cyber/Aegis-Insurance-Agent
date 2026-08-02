import { open } from "node:fs/promises";
import {
  detectFormat,
  extensionMatchesFormat,
  HEAD_BYTES,
  type FileFormat,
} from "./fileTypes";

export interface ScanResult {
  clean: boolean;
  reason?: string;
  /** What the bytes actually were, when they were recognised at all. */
  format?: string;
}

/**
 * True when the file's actual leading bytes match a permitted format. Pure and
 * synchronous so it is unit-testable without touching the filesystem.
 */
export function isAllowedFileContent(head: Buffer): boolean {
  return detectFormat(head) !== null;
}

/**
 * Content-based security scan for an uploaded file.
 *
 * The multer filter only sees the *declared* MIME type, which a client can set
 * to anything, so this is where a disguised file is actually caught. Two things
 * are checked:
 *
 *   1. the real magic bytes are one of the permitted formats, and
 *   2. the filename's extension agrees with what those bytes say it is.
 *
 * The second check matters now that eight formats are permitted rather than
 * two: without it, a `.pdf` holding an MP4 would sail through simply because
 * MP4 is on the list, and everything downstream that trusts the extension —
 * previews, OCR, a virus scanner picked by type — would be reasoning about the
 * wrong thing.
 *
 * This catches format-disguise, not malware inside a genuinely-formatted file.
 * A full antivirus (ClamAV via clamd, or an AV API) is a deploy-time addition
 * that plugs into this same hook — see PROD_READINESS.md.
 */
export async function scanFile(filepath: string, filename?: string): Promise<ScanResult> {
  let head: Buffer;
  try {
    const fh = await open(filepath, "r");
    try {
      const buf = Buffer.alloc(HEAD_BYTES);
      const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
      head = buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  } catch {
    // A file we cannot read is not one we can vouch for — fail closed.
    return { clean: false, reason: "file could not be read for scanning" };
  }

  const format: FileFormat | null = detectFormat(head);
  if (!format) {
    return { clean: false, reason: "file content does not match an allowed type" };
  }

  const declaredName = filename ?? filepath;
  if (!extensionMatchesFormat(declaredName, format)) {
    return {
      clean: false,
      reason: `file content is ${format.id}, which does not match its name`,
      format: format.id,
    };
  }

  return { clean: true, format: format.id };
}
