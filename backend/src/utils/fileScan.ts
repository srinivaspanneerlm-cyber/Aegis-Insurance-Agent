export interface ScanResult {
  clean: boolean;
  reason?: string;
}

/**
 * Malware/virus scan hook for uploaded files. The default implementation is a
 * no-op that passes everything — it exists so production can drop in a real
 * scanner (e.g. ClamAV via clamd, or an AV API) WITHOUT changing the upload
 * flow. Return `{ clean: false, reason }` to have the upload rejected and the
 * file removed.
 */
export async function scanFile(_filepath: string): Promise<ScanResult> {
  // TODO(prod): integrate ClamAV/clamd or an AV service here.
  return { clean: true };
}
