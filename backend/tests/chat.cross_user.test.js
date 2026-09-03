/**
 * Cross-user isolation over the real HTTP stack, for /api/v1/chat and
 * /api/v1/chat/stream.
 *
 * `tests/tenant-isolation.test.js` already proves this at the controller
 * level with a mocked repository — real, valuable, but it never drives an
 * actual JWT, an actual Prisma row, or an actual second user through the
 * real routes. This is that: two real registered accounts, real auth
 * cookies, a real (throwaway) database. Mallory knows Alice's session_id
 * (she could have seen it in a URL, a support ticket, a bug report) and
 * tries to ride it — the point is that knowing it buys her nothing.
 *
 * Also covers the AI-prompt side of the same property: `ai.service.ts`
 * states "history fetch ... scope[s] strictly to the authenticated user" —
 * verified here by inspecting what the stand-in AI engine actually receives
 * when Mallory streams into Alice's session_id, rather than trusting the
 * comment.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AI_MAX = "500";

const http = require("http");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-crossuser-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const fs = require("fs");
const assert = require("node:assert/strict");
const { test, describe, before, after, beforeEach } = require("node:test");
const request = require("supertest");

const BROWSER_ORIGIN = "http://localhost:3000";

let app;
let engine;
let forwardedBodies;

before(async () => {
  engine = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { /* ignore */ }
      forwardedBodies.push(body);
      if (req.url.endsWith("/chat/stream")) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ type: "done", session_id: body.session_id })}\n\n`);
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply: "Noted.", agent_name: "Sarah AI", agent_domain: "health" }));
      }
    });
  });
  await new Promise((resolve) => engine.listen(0, "127.0.0.1", resolve));
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${engine.address().port}/api/ai`;
  app = require("../src/app");
});

after(async () => {
  await new Promise((resolve) => engine.close(resolve));
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

beforeEach(() => {
  forwardedBodies = [];
});

const signIn = async (label) => {
  const agent = request.agent(app).set("Origin", BROWSER_ORIGIN);
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const reg = await agent.post("/api/v1/auth/register").send({
    name: label,
    email,
    password: "verylongpassword123",
  });
  assert.equal(reg.status, 201);
  return agent;
};

describe("cross-user isolation — /api/v1/chat", () => {
  test("Mallory cannot read Alice's history by guessing her session_id", async () => {
    const alice = await signIn("alice");
    const mallory = await signIn("mallory");
    const sessionId = `alice-private-session-${Date.now()}`;

    const posted = await alice.post("/api/v1/chat").send({
      message: "I have a pre-existing condition, please don't tell anyone",
      session_id: sessionId,
    });
    assert.equal(posted.status, 201);

    // Positive control: Alice can read her own turn back.
    const aliceRead = await alice.get(`/api/v1/chat?session_id=${sessionId}`);
    assert.equal(aliceRead.status, 200);
    assert.ok(
      aliceRead.body.data.chat.some((m) => m.message.includes("pre-existing condition")),
      "the positive control must actually find Alice's own message"
    );

    // The actual property under test: Mallory, naming the same session_id,
    // gets nothing — not Alice's row, not an error that would confirm the
    // session exists.
    const malloryRead = await mallory.get(`/api/v1/chat?session_id=${sessionId}`);
    assert.equal(malloryRead.status, 200);
    assert.equal(malloryRead.body.data.chat.length, 0);
  });

  test("an unauthenticated caller cannot read anyone's history", async () => {
    const res = await request(app).get("/api/v1/chat");
    assert.equal(res.status, 401);
  });
});

describe("cross-user isolation — /api/v1/chat/stream", () => {
  test("Mallory streaming into Alice's session_id never sends Alice's history to the engine", async () => {
    const alice = await signIn("alice-stream");
    const mallory = await signIn("mallory-stream");
    const sessionId = `alice-stream-session-${Date.now()}`;

    const secret = "my income is exactly 1234567 and I have diabetes";
    await alice.post("/api/v1/chat").send({ message: secret, session_id: sessionId });

    await mallory.post("/api/v1/chat/stream").send({
      message: "hello",
      session_id: sessionId,
    });

    // Alice's own POST reaches the engine too (her non-streaming turn) — the
    // one under test is Mallory's stream request, the last one sent.
    assert.equal(forwardedBodies.length, 2);
    const sentHistory = JSON.stringify(forwardedBodies[forwardedBodies.length - 1].history || []);
    assert.ok(!sentHistory.includes(secret), "Alice's message must never reach the engine on Mallory's behalf");
    assert.ok(!sentHistory.includes("1234567"));
  });
});
