/**
 * Leave nothing behind.
 *
 * The database is a temporary file, but "temporary" is a claim a process makes
 * and then crashes before honouring. Deleting it explicitly means a developer
 * who runs the suite a hundred times does not accumulate a hundred databases.
 */
import fs from "node:fs";

export default async function globalTeardown() {
  const dbFile = process.env.E2E_DB_FILE;
  if (!dbFile) return;
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* already gone */
    }
  }
}
