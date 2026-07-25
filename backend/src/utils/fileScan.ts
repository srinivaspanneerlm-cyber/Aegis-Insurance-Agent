import { open } from "node:fs/promises";

export interface ScanResult {
  clean: boolean;
  reason?: string;
}

// Leading-byte signatures of the formats the upload flow permits (.pdf, .docx).
// DOCX is an OOXML zip, so it carries the standard local-file-header ZIP magic.
const ALLOWED_SIGNATURES: ReadonlyArray<{ name: string; bytes: number[] }> = [
  { name: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { name: "zip/ooxml", bytes: [0x50, 0x4b, 0x03, 0x04] }, // "PK\x03\x04"
];

/**
 * True when the file's actual leading bytes match an allowed format. Pure and
 * synchronous so it is unit-testable without touching the filesystem.
 */
export function isAllowedFileContent(head: Buffer): boolean {
  return ALLOWED_SIGNATURES.some((sig) =>
    sig.bytes.every((byte, i) => head[i] === byte)
  );
}

/**
 * Content-based security scan for an uploaded file. It verifies the file's real
 * magic bytes match an allowed type — the multer filter only checks the
 * *declared* MIME, which a client can spoof (evil.exe renamed to evil.pdf), so
 * this is where a disguised file is actually caught. Return `{ clean: false }`
 * to have the upload rejected and the file removed.
 *
 * This catches format-disguise, not malware inside a genuinely-formatted file.
 * A full antivirus (ClamAV via clamd, or an AV API) is a deploy-time addition
 * that plugs into this same hook — see PROD_READINESS.md.
 */
export async function scanFile(filepath: string): Promise<ScanResult> {
  let head: Buffer;
  try {
    const fh = await open(filepath, "r");
    try {
      const buf = Buffer.alloc(8);
      const { bytesRead } = await fh.read(buf, 0, 8, 0);
      head = buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  } catch {
    // A file we cannot read is not one we can vouch for — fail closed.
    return { clean: false, reason: "file could not be read for scanning" };
  }

  if (!isAllowedFileContent(head)) {
    return { clean: false, reason: "file content does not match an allowed type" };
  }
  return { clean: true };
}
