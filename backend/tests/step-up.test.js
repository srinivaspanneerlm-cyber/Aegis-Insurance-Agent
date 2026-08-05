/**
 * Step-up re-authentication, driven through the real app.
 *
 * A session establishes that somebody signed in. It says nothing about who is
 * at the keyboard an hour later — on an office machine left unlocked, or the
 * one household laptop. For the handful of actions that cannot be undone, that
 * gap is worth one more question.
 *
 * The cases below are mostly about the ways this could be made decorative:
 * satisfying it with a credential the browser already holds, satisfying it as
 * the wrong person, or having it outlive the sitting it was granted in.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "1000"; // this suite is one IP; 20/hour is right in production

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-stepup-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { STEP_UP_COOKIE_NAME } = require("../src/utils/cookies");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "step-up-test-password-123";

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

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

/** A signed-in superadmin — the only role that may delete a lead. */
async function signInAsSuperadmin(tag) {
  const email = `stepup-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: "Step Up Subject", email, password: PASSWORD });
  assert.equal(res.status, 201);

  const userId = res.body.data.user.id;
  await prisma.user.update({ where: { id: userId }, data: { role: "PLATFORM_ADMIN" } });
  return { userId, email, cookie: cookieHeader(res) };
}

const createLead = () =>
  prisma.lead.create({
    data: {
      customerName: "Pipeline Person",
      email: `lead-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      phone: "9000000000",
      insuranceType: "health",
      budget: "10000",
    },
  });

const deleteLead = (cookie, id) =>
  request(app).delete(`/api/v1/leads/${id}`).set("Cookie", cookie).set("Origin", ORIGIN);

const stepUp = (cookie, body) =>
  request(app).post("/api/v1/auth/step-up").set("Cookie", cookie).set("Origin", ORIGIN).send(body);

describe("Step-up — the gate", () => {
  test("an irreversible action is refused without a fresh confirmation", async () => {
    const { cookie } = await signInAsSuperadmin("gate");
    const lead = await createLead();

    const res = await deleteLead(cookie, lead.id);
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "REAUTH_REQUIRED");
  });

  test("the refusal is distinguishable from a dead session", async () => {
    // They are both 401s. If the portal cannot tell them apart it will sign the
    // customer out at the exact moment they were being careful.
    const { cookie } = await signInAsSuperadmin("distinct");
    const lead = await createLead();

    const gated = await deleteLead(cookie, lead.id);
    const noSession = await request(app)
      .delete(`/api/v1/leads/${lead.id}`)
      .set("Origin", ORIGIN);

    assert.equal(gated.body.code, "REAUTH_REQUIRED");
    assert.notEqual(noSession.body.code, "REAUTH_REQUIRED");
  });

  test("confirming with the password lets the action through", async () => {
    const { cookie } = await signInAsSuperadmin("confirm");
    const lead = await createLead();

    const confirmed = await stepUp(cookie, { password: PASSWORD });
    assert.equal(confirmed.status, 200);

    const withProof = `${cookie}; ${cookieHeader(confirmed)}`;
    const res = await deleteLead(withProof, lead.id);
    assert.equal(res.status, 204);
    assert.equal(await prisma.lead.count({ where: { id: lead.id } }), 0);
  });

  test("a wrong password confirms nothing", async () => {
    const { cookie } = await signInAsSuperadmin("wrong");
    const res = await stepUp(cookie, { password: "not-the-password" });
    assert.equal(res.status, 401);
    assert.ok(!(res.headers["set-cookie"] || []).some((c) => c.startsWith(STEP_UP_COOKIE_NAME)));
  });

  test("it applies to catalogue changes too, not just deletion", async () => {
    // Adding an insurer changes what every customer is recommended.
    const { cookie } = await signInAsSuperadmin("catalogue");
    const res = await request(app)
      .post("/api/v1/company")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ companyName: "New Insurer Ltd" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "REAUTH_REQUIRED");
  });

  test("permission is still required — confirming is not a promotion", async () => {
    // A customer who proves who they are is still a customer. If step-up could
    // stand in for a capability, the whole permission model would be optional.
    const email = `stepup-customer-${Date.now()}@test.com`;
    const reg = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", ORIGIN)
      .send({ name: "Ordinary Customer", email, password: PASSWORD });
    const cookie = cookieHeader(reg);

    const confirmed = await stepUp(cookie, { password: PASSWORD });
    assert.equal(confirmed.status, 200, "anyone may confirm who they are");

    const lead = await createLead();
    const res = await deleteLead(`${cookie}; ${cookieHeader(confirmed)}`, lead.id);
    assert.equal(res.status, 403, "but it grants no capability");
  });
});

describe("Step-up — the ways it could be made decorative", () => {
  test("an ordinary access token does not satisfy it", async () => {
    // Same signing key, same shape, and already in the browser. Without the
    // purpose claim this gate would be satisfied by the credential it is
    // supposed to be asking beyond.
    const { userId, cookie } = await signInAsSuperadmin("purpose");
    const lead = await createLead();

    const accessLike = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "5m" });
    const res = await deleteLead(`${cookie}; ${STEP_UP_COOKIE_NAME}=${accessLike}`, lead.id);

    assert.equal(res.status, 401);
  });

  test("one person's confirmation does not work for another", async () => {
    const alice = await signInAsSuperadmin("alice");
    const bob = await signInAsSuperadmin("bob");
    const lead = await createLead();

    const aliceProof = cookieHeader(await stepUp(alice.cookie, { password: PASSWORD }));
    // Bob's session, Alice's proof.
    const res = await deleteLead(`${bob.cookie}; ${aliceProof}`, lead.id);

    assert.equal(res.status, 401);
  });

  test("an expired confirmation is refused", async () => {
    const { userId, cookie } = await signInAsSuperadmin("expired");
    const lead = await createLead();

    const stale = jwt.sign({ id: userId, purpose: "step-up" }, process.env.JWT_SECRET, {
      expiresIn: "-1s",
    });
    const res = await deleteLead(`${cookie}; ${STEP_UP_COOKIE_NAME}=${stale}`, lead.id);

    assert.equal(res.status, 401);
  });

  test("a forged confirmation is refused", async () => {
    const { userId, cookie } = await signInAsSuperadmin("forged");
    const lead = await createLead();

    const forged = jwt.sign({ id: userId, purpose: "step-up" }, "attacker-key-attacker-key-x");
    const res = await deleteLead(`${cookie}; ${STEP_UP_COOKIE_NAME}=${forged}`, lead.id);

    assert.equal(res.status, 401);
  });

  test("signing out takes the confirmation with it", async () => {
    // Otherwise it outlives the sitting it was granted in, which on a shared
    // device hands the next person a head start.
    const { cookie } = await signInAsSuperadmin("logout");
    const confirmed = await stepUp(cookie, { password: PASSWORD });

    const out = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `${cookie}; ${cookieHeader(confirmed)}`)
      .set("Origin", ORIGIN);

    const cleared = (out.headers["set-cookie"] || []).some(
      (c) => c.startsWith(`${STEP_UP_COOKIE_NAME}=`) && /Expires=Thu, 01 Jan 1970|Max-Age=0/.test(c)
    );
    assert.ok(cleared, "the confirmation cookie is cleared on logout");
  });

  test("confirming requires a session of its own", async () => {
    const res = await request(app)
      .post("/api/v1/auth/step-up")
      .set("Origin", ORIGIN)
      .send({ password: PASSWORD });
    assert.equal(res.status, 401);
  });

  test("an empty proof is rejected by validation", async () => {
    const { cookie } = await signInAsSuperadmin("empty");
    const res = await stepUp(cookie, {});
    assert.equal(res.status, 400);
  });

  test("a provider credential for an unlinked identity proves nothing", async () => {
    // Verifying a credential shows the provider vouches for somebody. Only the
    // link shows that somebody is this account.
    const { cookie } = await signInAsSuperadmin("unlinked");
    const res = await stepUp(cookie, { provider: "google", credential: "not-a-real-token" });
    assert.equal(res.status, 401);
  });
});
