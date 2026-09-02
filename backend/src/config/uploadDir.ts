import fs from "fs";
import path from "path";

/**
 * Where uploaded files live on disk.
 *
 * One constant rather than the same `path.join` in every route that accepts a
 * file. Two copies of this path is the kind of duplication that survives review
 * and then fails in production: one of them is changed for a deployment, the
 * other keeps writing to the old directory, and the files are not lost so much
 * as invisible.
 *
 * Local disk is the development story. A deployment behind more than one
 * process needs shared storage — an object store, or a volume both replicas
 * mount — and that swap happens here rather than in the routes.
 */
export const UPLOAD_DIR = path.join(__dirname, "../uploads");

/** Create it if it is not there yet. Safe to call repeatedly. */
export function ensureUploadDir(): string {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

/**
 * Whether a stored path really sits inside the upload directory.
 *
 * Every path this is asked about came from our own database, written by multer
 * from a name it generated itself — so this should always be true. It is
 * checked anyway, on the read path, because "should always" is the assumption
 * that turns one bad row into an arbitrary-file-read: the cost is a string
 * comparison and the alternative is trusting a column.
 */
export function isInsideUploadDir(filepath: string): boolean {
  const resolved = path.resolve(filepath);
  const root = path.resolve(UPLOAD_DIR);
  return resolved === root || resolved.startsWith(root + path.sep);
}
