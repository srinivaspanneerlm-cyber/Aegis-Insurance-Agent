/**
 * Prisma provider switch (PR-1b).
 *
 * The datasource provider is a literal Prisma cannot read from env, and the
 * migration lock pins it — so the deploy-time switch rewrites both. These tests
 * cover the pure transform: it must flip the datasource provider without ever
 * touching the generator's `prisma-client-js`, and round-trip cleanly.
 */
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const { rewriteProvider, VALID } = require("../scripts/set-db-provider");

const SCHEMA = [
  "datasource db {",
  '  provider = "sqlite"',
  '  url      = env("DATABASE_URL")',
  "}",
  "generator client {",
  '  provider = "prisma-client-js"',
  "}",
].join("\n");

describe("set-db-provider transform", () => {
  test("flips the datasource provider to postgresql, leaves the generator untouched", () => {
    const out = rewriteProvider(SCHEMA, "postgresql");
    assert.match(out, /provider = "postgresql"/);
    assert.match(out, /provider = "prisma-client-js"/); // generator intact
    assert.ok(!out.includes('provider = "sqlite"'));
  });

  test("round-trips back to sqlite", () => {
    const pg = rewriteProvider(SCHEMA, "postgresql");
    assert.match(rewriteProvider(pg, "sqlite"), /provider = "sqlite"/);
  });

  test("is idempotent for an already-set provider", () => {
    const once = rewriteProvider(SCHEMA, "postgresql");
    assert.equal(rewriteProvider(once, "postgresql"), once);
  });

  test("rewrites the migration lock line", () => {
    assert.equal(
      rewriteProvider('provider = "sqlite"', "postgresql"),
      'provider = "postgresql"'
    );
  });

  test("VALID lists exactly the supported providers", () => {
    assert.deepEqual(VALID, ["sqlite", "postgresql"]);
  });
});
