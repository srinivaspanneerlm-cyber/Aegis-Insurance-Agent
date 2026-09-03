/**
 * Aegis Kural Lite over HTTP, through the real app.
 *
 * The unit suite covers what it answers. This one covers the things only the
 * whole stack can answer: that a question is bounded before it reaches anything,
 * that "I do not know" arrives as an answer rather than as an error, that the
 * disclaimer and the offer of a person are on every reply without a caller
 * having to remember them, and that naming somebody else's policy leaks nothing.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-kural-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after, before } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";
const API = "/api/v1/consumer";

after(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag) {
  seq += 1;
  const email = `kural-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Person ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { cookie: cookieHeader(res), userId: res.body.data.user.id };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  post: (p) => request(app).post(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
});

const ask = (cookie, question, extra = {}) =>
  api(cookie).post("/kural/ask").send({ question, ...extra });

function dateIn(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let plate = 0;
async function policyFor(cookie, over = {}) {
  plate += 1;
  const res = await api(cookie).post("/policies").send({
    insurer: "Bharat General Insurance",
    policyNumber: `POL/2026/${String(plate).padStart(6, "0")}`,
    policyType: "COMPREHENSIVE",
    expiryDate: dateIn(20),
    vehicle: { registrationNumber: `TN 09 AB ${3000 + plate}`, vehicleType: "BIKE" },
    ...over,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.policy;
}

// ── What it can be asked ─────────────────────────────────────────────────────

describe("the opening screen", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("topics")); });

  test("names all six topics before the first question", async () => {
    // A customer who has to discover the limits by hitting them has already
    // been told the product does not work.
    const res = await api(cookie).get("/kural/topics");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.topics.length, 6);
    assert.deepEqual(
      res.body.data.topics.map((t) => t.topic).sort(),
      ["COVER_TYPES", "IDV", "NCB", "POLICY_EXPIRY", "RENEWAL_STEPS", "ZERO_DEPRECIATION"]
    );
  });

  test("introduces itself by admitting its limits", async () => {
    const res = await api(cookie).get("/kural/topics");
    assert.match(res.body.data.intro, /checked notes/i);
    assert.ok(res.body.data.scopeNote.length > 0);
    assert.ok(res.body.data.humanCta.length > 0);
    assert.ok(res.body.data.disclaimer.length > 0);
  });

  test("answers in Tamil when asked to", async () => {
    const res = await api(cookie).get("/kural/topics?locale=ta");
    assert.match(res.body.data.intro, /[஀-௿]/);
    assert.match(res.body.data.topics[0].title, /[஀-௿]/);
  });
});

// ── Answering ────────────────────────────────────────────────────────────────

describe("answering a question it knows", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("answer")); });

  test("returns the topic, the answer and where it came from", async () => {
    const res = await ask(cookie, "what is zero depreciation?");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.outcome, "ANSWERED");
    assert.equal(res.body.data.topic, "ZERO_DEPRECIATION");
    assert.match(res.body.data.answer, /depreciation/i);
    assert.equal(res.body.data.source.kind, "layer1");
    assert.match(res.body.data.source.reference, /Aegis-AI\/layer1/);
  });

  test("every answer carries the disclaimer, the scope note and a person", async () => {
    // Attached by the service, not by the caller — a screen cannot render an
    // answer without them by forgetting to ask.
    for (const question of ["what is idv", "what is ncb", "how do i renew"]) {
      const res = await ask(cookie, question);
      assert.ok(res.body.data.disclaimer.length > 0, question);
      assert.match(res.body.data.scopeNote, /not a statement about your own policy/i);
      assert.match(res.body.data.humanCta, /person/i);
    }
  });

  test("it answers the same question the same way every time", async () => {
    // Deterministic by construction. Two customers asking alike, or one asking
    // twice, cannot be told different things.
    const first = await ask(cookie, "third party or comprehensive?");
    const second = await ask(cookie, "third party or comprehensive?");
    assert.equal(first.body.data.answer, second.body.data.answer);
    assert.equal(first.body.data.topic, second.body.data.topic);
  });

  test("it answers in the customer's language", async () => {
    const res = await api(cookie).post("/kural/ask?locale=ta").send({ question: "what is idv" });
    assert.equal(res.body.data.outcome, "ANSWERED");
    assert.match(res.body.data.answer, /[஀-௿]/);
    assert.match(res.body.data.scopeNote, /[஀-௿]/);
  });

  test("it offers a related topic without changing its answer", async () => {
    const res = await ask(cookie, "does comprehensive include zero depreciation");
    assert.equal(res.body.data.outcome, "ANSWERED");
    assert.ok(Array.isArray(res.body.data.suggestions));
    assert.ok(!res.body.data.suggestions.some((s) => s.topic === res.body.data.topic));
  });
});

// ── Refusing ─────────────────────────────────────────────────────────────────

describe("a question outside the six topics", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("refuse")); });

  test("is answered with 200 and an honest no", async () => {
    // A 4xx would make a browser's error handling swallow the sentence that
    // says what to do next.
    const res = await ask(cookie, "does my policy cover flood damage?");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.outcome, "NO_MATCH");
    assert.equal(res.body.data.topic, null);
    assert.match(res.body.data.answer, /do not have a checked answer/i);
  });

  test("still offers a person, which is the actual answer", async () => {
    const res = await ask(cookie, "can i claim for a cracked windscreen");
    assert.match(res.body.data.humanCta, /person/i);
    assert.ok(res.body.data.suggestions.length > 0, "a dead end is where somebody leaves");
  });

  test("it never invents a source for an answer it did not give", async () => {
    const res = await ask(cookie, "what is the cheapest policy");
    assert.equal(res.body.data.source, null);
  });

  test("an empty question is told it could not be read, not that it was wrong", async () => {
    const res = await ask(cookie, "   ");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.outcome, "UNREADABLE");
    assert.match(res.body.data.answer, /could not read that as a question/i);
  });

  test("a question longer than we can read is refused at the door", async () => {
    // Bounded rather than truncated: cutting it would answer a question the
    // customer did not finish asking.
    const res = await ask(cookie, "idv ".repeat(200));
    assert.equal(res.status, 400);
    assert.match(res.body.message, /sentence or two/i);
  });

  test("fields it does not accept are refused outright", async () => {
    const res = await ask(cookie, "what is idv", { topic: "NCB", answer: "anything" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /cannot be set here/i);
  });

  test("a question that is not text at all is refused", async () => {
    for (const question of [undefined, null, 42, { text: "hi" }, ["hi"]]) {
      const res = await api(cookie).post("/kural/ask").send({ question });
      assert.equal(res.status, 400, JSON.stringify(question));
    }
  });
});

// ── About your own policy ────────────────────────────────────────────────────

describe("when a question names one of the customer's own policies", () => {
  let mine;
  let theirs;
  let myPolicy;

  before(async () => {
    mine = await account("mine");
    theirs = await account("theirs");
    myPolicy = await policyFor(mine.cookie, { expiryDate: dateIn(5) });
  });

  test("the expiry answer carries the renewal engine's verdict on that policy", async () => {
    const res = await ask(mine.cookie, "when does my policy expire?", { policyId: myPolicy.id });
    assert.equal(res.body.data.outcome, "ANSWERED");
    assert.equal(res.body.data.topic, "POLICY_EXPIRY");
    assert.ok(res.body.data.aboutYourPolicy, "the customer's own policy should be spoken to");
    assert.equal(res.body.data.aboutYourPolicy.expiryDate, dateIn(5));
    assert.match(res.body.data.aboutYourPolicy.status, /expires in a few days/i);
    assert.ok(res.body.data.aboutYourPolicy.nextAction.length > 0);
  });

  test("a different topic gets the general answer and nothing personal", async () => {
    // The one specific fact enters only where it belongs. An answer about NCB
    // has no business quoting somebody's expiry date.
    const res = await ask(mine.cookie, "what is ncb", { policyId: myPolicy.id });
    assert.equal(res.body.data.topic, "NCB");
    assert.equal(res.body.data.aboutYourPolicy, null);
  });

  test("somebody else's policy tells them nothing, and still answers", async () => {
    // Refusing the whole answer would punish the customer for a client-side
    // mistake they cannot see; including the policy would be a leak.
    const res = await ask(theirs.cookie, "when does my policy expire?", { policyId: myPolicy.id });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.outcome, "ANSWERED");
    assert.equal(res.body.data.aboutYourPolicy, null);
    assert.ok(!JSON.stringify(res.body).includes(dateIn(5)));
  });

  test("a policy id that is not an id is refused rather than searched for", async () => {
    const res = await ask(mine.cookie, "when does my policy expire", { policyId: "x".repeat(200) });
    assert.equal(res.status, 400);
  });
});

// ── The door ─────────────────────────────────────────────────────────────────

describe("who may ask", () => {
  test("signing out closes it", async () => {
    const topics = await request(app).get(`${API}/kural/topics`).set("Origin", ORIGIN);
    assert.equal(topics.status, 401);

    const asked = await request(app)
      .post(`${API}/kural/ask`)
      .set("Origin", ORIGIN)
      .send({ question: "what is idv" });
    assert.equal(asked.status, 401);
  });
});

// ── The record ───────────────────────────────────────────────────────────────

describe("what is written down", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("audit")); });

  test("it records that a question was answered, and which topic", async () => {
    await ask(cookie, "what is zero depreciation");
    const rows = await prisma.auditLog.findMany({ where: { action: "consumer.kural.answered" } });
    assert.ok(rows.length > 0);
    assert.ok(JSON.stringify(rows).includes("ZERO_DEPRECIATION"));
  });

  test("an unanswered question is recorded too, because that is what to count", async () => {
    await ask(cookie, "does my policy cover hailstones");
    const rows = await prisma.auditLog.findMany({ where: { action: "consumer.kural.unanswered" } });
    assert.ok(rows.length > 0, "the gaps are the useful thing to measure");
  });

  test("what somebody asked is never written down", async () => {
    // What a person asks about their own insurance is theirs. That the
    // assistant could not answer is ours, and only the second is recorded.
    await ask(cookie, "my registration is TN09XY4321 and i am worried about hailstones");
    const rows = await prisma.auditLog.findMany({ where: { action: { startsWith: "consumer.kural" } } });
    assert.ok(!JSON.stringify(rows).includes("TN09XY4321"), "the question reached the audit trail");
    assert.ok(!JSON.stringify(rows).includes("hailstones"));
  });
});
