/**
 * Run the test suite against a throwaway database.
 *
 * `npm test` used to inherit `DATABASE_URL` from `.env`, which points at
 * `prisma/dev.db` — the database the running application uses. The suite
 * registers accounts to exercise auth, uploads documents, opens conversations;
 * all of it landed in the development data. By the time anyone looked, 29 of
 * 34 accounts were test artefacts, and the only way to tell a real customer
 * from a fixture was the shape of their email address.
 *
 * That is worse than untidy. A suite that writes to the same place as the
 * application is one `deleteMany` in a new test away from destroying work
 * nobody had committed, and it makes "is this row real?" a question the code
 * cannot answer.
 *
 * So the suite gets its own file, rebuilt from nothing on every run: migrated,
 * seeded with the catalogue the application would normally have, and thrown
 * away. `DATABASE_URL` is passed explicitly to the child, which wins over
 * `.env` because dotenv never overwrites a variable that is already set.
 *
 * Deliberately does not touch `NODE_ENV`. The error middleware branches on it,
 * and tests assert on the development-shaped error body; changing it here
 * would silently rewrite what several suites are checking.
 *
 * Usage:
 *   npm test                          all suites
 *   npm test -- tests/keepalive.test.js   one file, same isolation
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** One fixed path, so a crashed run cannot leave a second stale database behind. */
const DB_FILE = process.env.TEST_DB_FILE || path.join(os.tmpdir(), "aegis-backend-test.db");
const DATABASE_URL = `file:${DB_FILE}`;

// A leftover from a crashed run is migrated but stale, and its rows would leak
// into the next run's assertions. Starting from nothing is the only honest state.
for (const stale of [DB_FILE, `${DB_FILE}-journal`]) {
  if (fs.existsSync(stale)) fs.unlinkSync(stale);
}

const childEnv = { ...process.env, DATABASE_URL };

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: backend,
  stdio: ["ignore", "ignore", "inherit"],
  env: childEnv,
});

// The catalogue the application would normally have. Without it a suite that
// reads /policies sees an empty shelf, which is not the state it was written
// against.
execFileSync(process.execPath, ["prisma/seed.js"], {
  cwd: backend,
  stdio: ["ignore", "ignore", "inherit"],
  env: childEnv,
});

console.log(`  test database ready → ${DB_FILE}`);

const targets = process.argv.slice(2);
const child = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...(targets.length ? targets : ["tests/"])],
  { cwd: backend, stdio: "inherit", env: childEnv }
);

process.exit(child.status ?? 1);
