/**
 * Create the database the run uses — before any server can open it.
 *
 * This runs from `playwright.config.ts` at module load rather than from
 * `globalSetup`, because Playwright starts `webServer` processes *first* and
 * global setup only afterwards. With the seeding in global setup, the backend
 * booted against a path with no file there, SQLite obligingly created an empty
 * one, and `/health/ready` passed — `SELECT 1` succeeds against a database with
 * no tables. Playwright then reported every server healthy and every test failed
 * at its first query, pointing at the login route rather than at the ordering.
 *
 * Doing it here means the file is migrated and seeded before a server exists to
 * open it.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seed } from "./fixtures/seed.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.join(here, "..", "backend");

const DB_FILE = process.argv[2];
if (!DB_FILE) throw new Error("prepare-db.mjs needs a database path");
const DATABASE_URL = `file:${DB_FILE}`;

// A leftover from a crashed run would be migrated but stale, and the seed would
// collide on its unique slugs. Starting from nothing is the only honest state.
for (const f of [DB_FILE, `${DB_FILE}-journal`]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

execSync("npx prisma migrate deploy", {
  cwd: backend,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL },
});

await seed(DATABASE_URL);
console.log(`  e2e database ready → ${DB_FILE}`);
