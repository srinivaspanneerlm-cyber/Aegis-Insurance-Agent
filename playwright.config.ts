import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * End-to-end tests, against the real product.
 *
 * Everything below runs on ports nobody develops on — backend 5900, identity
 * 3905, console 3903 — and against a throwaway SQLite file built fresh for the
 * run. That isolation is the point rather than tidiness: a browser suite
 * drives the whole application, and one pointed at a development database will
 * eventually destroy work somebody had not committed.
 *
 * `NEXT_DIST_DIR` sends the Next builds to `.next-e2e`, so a run cannot fight a
 * dev server over the `.next` directory it is already using.
 */
/** One fixed path, rebuilt from nothing at the start of every run. */
const DB_FILE = path.join(os.tmpdir(), "aegis-e2e.db");
const DATABASE_URL = `file:${DB_FILE}`;
process.env.E2E_DB_FILE = DB_FILE;

// Migrated and seeded here, at config load, because Playwright starts the
// servers below *before* it runs `globalSetup`. Seeding there let the backend
// open a path with no file at it, SQLite create an empty database, and
// `/health/ready` pass anyway — a green start followed by every test failing on
// a missing table.
// Guarded on the file's absence, because Playwright loads this config once per
// worker as well as in the main process. Unguarded, every load re-ran the
// preparation — deleting and reseeding the database underneath tests that were
// already running. Teardown removes the file, so the next run prepares again.
if (!fs.existsSync(DB_FILE)) {
  execSync(`node ${path.join(__dirname, "e2e", "prepare-db.mjs")} ${DB_FILE}`, {
    stdio: "inherit",
    cwd: __dirname,
  });
}

const BACKEND = "http://localhost:5900";
const IDENTITY = "http://localhost:3905";
const CONSOLE_URL = "http://localhost:3903";

/** The browser talks to the backend from two origins; both must be allowed. */
const CLIENT_URL = `${CONSOLE_URL},${IDENTITY}`;

const nextEnv = {
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_PUBLIC_API_URL: `${BACKEND}/api/v1`,
  NEXT_PUBLIC_IDENTITY_URL: IDENTITY,
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./e2e/specs",
  globalTeardown: "./e2e/global-teardown.mjs",

  // A browser test that fails intermittently teaches people to re-run rather
  // than to read, so failures are loud and retries are limited to CI.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: CONSOLE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: "npm start",
      cwd: "backend",
      url: `${BACKEND}/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
      env: {
        NODE_ENV: "development",
        PORT: "5900",
        DATABASE_URL,
        CLIENT_URL,
        // Where the backend tells a signed-in enterprise user to go next.
        ENTERPRISE_PORTAL_URL: CONSOLE_URL,
        JWT_SECRET: "e2e-only-signing-key-not-used-anywhere-real-0123456789",
        // A browser run makes many requests in a short window from one address.
        RL_API_MAX: "5000",
        RL_AUTH_MAX: "2000",
        // Nothing in these tests should reach a language model or send mail.
        FEATURE_RESPONSE_CACHE: "false",
      },
    },
    {
      command: "npx next dev --port 3905",
      cwd: "apps/identity",
      url: IDENTITY,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
      env: nextEnv,
    },
    {
      command: "npx next dev --port 3903",
      cwd: "apps/enterprise-portal",
      url: CONSOLE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
      env: nextEnv,
    },
  ],
});

export { BACKEND, IDENTITY, CONSOLE_URL };
