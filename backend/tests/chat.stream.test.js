/**
 * POST /api/v1/chat/stream — the advisor's SSE proxy, tested for the first time.
 *
 * This is the transport the voice reply rides (`stream_service.py`'s real
 * token-by-token streaming only reaches the customer through this hop), and
 * until now it had zero backend tests: auth-required was only ever curl'd by
 * hand, and neither the in-band error path nor the disconnect-aborts-upstream
 * behavior documented in `chat.controller.ts` had ever been exercised.
 *
 * Same shape as `voice.transcribe.test.js`: real Express app, real auth, a
 * stand-in AI engine on a local socket. Not wrapped in supertest's usual
 * `.expect()` chain for the streaming cases — the body is SSE text, read and
 * parsed by hand.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AI_MAX = "500";

const http = require("http");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-chatstream-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const fs = require("fs");
const assert = require("node:assert/strict");
const { test, describe, before, after, beforeEach } = require("node:test");
const request = require("supertest");

const BROWSER_ORIGIN = "http://localhost:3000";

let app;
let engine;
let engineHandler;

before(async () => {
  engine = http.createServer((req, res) => {
    engineHandler(req, res);
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

/** A real SSE reply, two tokens then done — the ordinary happy path. */
const sseOk = (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write(`data: ${JSON.stringify({ type: "agent_info", agent_name: "Sarah AI", agent_domain: "health" })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "token", text: "Hello" })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "token", text: " there" })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "done", session_id: "engine-session-1" })}\n\n`);
  res.end();
};

beforeEach(() => {
  engineHandler = sseOk;
});

const cookieHeaderFrom = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

const signIn = async () => {
  const agent = request.agent(app).set("Origin", BROWSER_ORIGIN);
  const email = `chatstream-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const reg = await agent.post("/api/v1/auth/register").send({
    name: "Streamer",
    email,
    password: "verylongpassword123",
  });
  assert.equal(reg.status, 201);
  agent.cookieHeader = cookieHeaderFrom(reg);
  return agent;
};

const streamBody = { message: "I need health cover for my parents" };

describe("POST /api/v1/chat/stream — access", () => {
  test("refuses an unauthenticated request", async () => {
    // A paid LLM call sits behind this — same reasoning as the voice route.
    const res = await request(app)
      .post("/api/v1/chat/stream")
      .set("Origin", BROWSER_ORIGIN)
      .send(streamBody);
    assert.equal(res.status, 401);
  });
});

describe("POST /api/v1/chat/stream — the happy path", () => {
  test("pipes the upstream tokens through verbatim, in order", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/chat/stream").send(streamBody);

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/event-stream/);

    const events = res.text
      .split("\n\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line.replace(/^data: /, "")));

    assert.deepEqual(
      events.map((e) => e.type),
      ["agent_info", "token", "token", "done"]
    );
    assert.equal(events[1].text + events[2].text, "Hello there");
  });
});

describe("POST /api/v1/chat/stream — when the engine fails", () => {
  test("reports failure as an in-band SSE error event, not an HTTP error status", async () => {
    // Headers are already flushed by the time dispatch is attempted (SSE
    // requires that), so a failure can only be reported inside the stream —
    // confirmed here rather than assumed from reading the controller.
    engineHandler = (req, res) => res.destroy();

    const agent = await signIn();
    const res = await agent.post("/api/v1/chat/stream").send(streamBody);

    assert.equal(res.status, 200);
    assert.match(res.text, /"type":\s*"error"/);
    assert.match(res.text, /advisor is unavailable/i);
  });

  test("never echoes the upstream's internal error text to the client", async () => {
    engineHandler = (req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "Traceback: /srv/app/orchestrator.py, key sk-live-abc" }));
    };

    const agent = await signIn();
    const res = await agent.post("/api/v1/chat/stream").send(streamBody);

    assert.equal(res.status, 200);
    assert.doesNotMatch(res.text, /Traceback|orchestrator\.py|sk-live/);
  });
});

describe("POST /api/v1/chat/stream — client disconnect", () => {
  test("aborts the upstream call when the client goes away mid-stream", async () => {
    let upstreamAborted = false;
    let firstChunkSent;
    const firstChunkSentPromise = new Promise((resolve) => { firstChunkSent = resolve; });

    engineHandler = (req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ type: "thinking", step: "intent" })}\n\n`);
      firstChunkSent();
      req.on("close", () => { upstreamAborted = true; });
      // Deliberately never ends — the only way this resolves is the client
      // disconnecting and the abort propagating upstream.
    };

    const agentSignIn = await signIn();
    const cookieHeader = agentSignIn.cookieHeader;

    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    const port = server.address().port;

    await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: "/api/v1/chat/stream",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: BROWSER_ORIGIN,
            Cookie: cookieHeader,
          },
        },
        (res) => {
          res.on("data", async () => {
            await firstChunkSentPromise;
            req.destroy();
          });
        }
      );
      req.on("error", () => resolve()); // destroying our own request errors it — expected
      req.write(JSON.stringify(streamBody));
      req.end();
      setTimeout(resolve, 2000);
    });

    await new Promise((resolve) => server.close(resolve));
    assert.equal(upstreamAborted, true, "the upstream request must be aborted, not left running");
  });
});
