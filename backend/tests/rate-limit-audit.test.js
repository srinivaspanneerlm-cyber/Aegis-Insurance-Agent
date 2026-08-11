/**
 * Rate-limit blocks, as a security event.
 *
 * Task 9.7. A blocked request used to just get a 429 and vanish — a sustained
 * brute-force or scraping burst against `authLimiter` (or any of the other
 * limiters, which share the same handler) was invisible to the audit trail.
 * This pins that a block still behaves exactly as before *and* leaves a
 * record behind.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "3"; // deliberately low — this file wants to trip it

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-ratelimit-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";

after(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
});

describe("the auth rate limiter, once tripped", () => {
  test("the block still answers exactly as before, and leaves an audit record", async () => {
    const attempt = () =>
      request(app)
        .post("/api/v1/auth/login")
        .set("Origin", ORIGIN)
        .send({ email: "nobody@test.com", password: "whatever-it-is" });

    let blocked;
    for (let i = 0; i < 5; i++) {
      const res = await attempt();
      if (res.status === 429) {
        blocked = res;
        break;
      }
    }

    assert.ok(blocked, "the limiter must trip within a handful of requests");
    assert.equal(blocked.body.status, "fail");
    assert.match(blocked.body.message, /too many/i);

    const entry = await prisma.auditLog.findFirst({
      where: { action: "security.rate_limit.auth" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(entry, "the block left something for a security review to find");
    const metadata = JSON.parse(entry.metadata);
    assert.equal(metadata.path, "/api/v1/auth/login");
  });
});
