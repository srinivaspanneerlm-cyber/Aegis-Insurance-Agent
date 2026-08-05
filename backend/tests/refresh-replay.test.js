/**
 * Refresh-token reuse, driven through the real app.
 *
 * Rotation already made a refresh token single-use, but nothing acted on the
 * evidence that came with it. A spent token turning up again means one that
 * should have been destroyed is in circulation, and until now the response was
 * a 401 to whoever asked — which, if the asker was the customer, left the
 * *thief* holding the freshly rotated token and working normally.
 *
 * We cannot tell the two apart: both hold credentials from the same lineage.
 * So the answer is to end every session and make the customer sign in, which
 * costs them a password and costs the thief everything.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
// Reuse detection can only be exercised by signing in and renewing repeatedly,
// and the whole suite is one IP to the auth throttle. Raised here rather than
// weakened in the app: 20/hour is the right number in production.
process.env.RL_AUTH_MAX = "1000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-replay-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "replay-test-password-123";

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

/** A signed-in customer and the cookies a browser would resend. */
async function signIn(tag) {
  const email = `replay-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: "Replay Subject", email, password: PASSWORD });
  assert.equal(res.status, 201);
  return { email, userId: res.body.data.user.id, cookie: cookieHeader(res) };
}

const renew = (cookie) =>
  request(app).post("/api/v1/auth/refresh").set("Cookie", cookie).set("Origin", ORIGIN);

const liveTokens = (userId) =>
  prisma.refreshToken.count({ where: { userId, revokedAt: null } });

/**
 * Age a user's revoked tokens past the grace window, so the next presentation
 * is read as reuse rather than as two tabs racing.
 */
const ageRevocations = (userId) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: { not: null } },
    data: { revokedAt: new Date(Date.now() - 60_000) },
  });

describe("Refresh reuse — a token that was already spent", () => {
  test("the replayed token is refused", async () => {
    const { cookie, userId } = await signIn("refused");
    const first = await renew(cookie);
    assert.equal(first.status, 200, "the first renewal works");

    await ageRevocations(userId);
    const replay = await renew(cookie); // the same, now-spent cookie
    assert.equal(replay.status, 401);
  });

  test("every other session of that customer is ended too", async () => {
    // The point of the whole change. The thief's rotated token is live and
    // indistinguishable from the customer's, so both have to go.
    const { cookie, userId } = await signIn("sweep");

    const rotated = await renew(cookie);
    assert.equal(rotated.status, 200);
    assert.ok((await liveTokens(userId)) > 0, "a live token exists before the replay");

    await ageRevocations(userId);
    await renew(cookie);

    assert.equal(await liveTokens(userId), 0, "no session survives a replay");
  });

  test("the token the thief rotated stops working as well", async () => {
    // Proved end to end rather than by counting rows: the credential that was
    // working a moment ago is refused after the sweep.
    const { cookie, userId } = await signIn("stolen");

    const stolen = await renew(cookie);
    assert.equal(stolen.status, 200);
    const stolenCookie = cookieHeader(stolen);

    // The real customer's client retries with the token it still holds.
    await ageRevocations(userId);
    await renew(cookie);

    const thiefRetry = await renew(stolenCookie);
    assert.equal(thiefRetry.status, 401);
  });

  test("it is recorded as a security event, not a routine rejection", async () => {
    const { cookie, userId } = await signIn("audited");
    await renew(cookie);
    await ageRevocations(userId);
    await renew(cookie);

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: "auth.refresh.replay" },
    });
    assert.ok(entry, "a replay leaves something for someone to find");
  });

  test("the refusal does not say why", async () => {
    // "That token was already used" tells whoever is probing that they have a
    // real token from a real session.
    const { cookie, userId } = await signIn("quiet");
    await renew(cookie);
    await ageRevocations(userId);

    const replay = await renew(cookie);
    assert.ok(!/reus|replay|already/i.test(replay.body.message ?? ""));
  });

  test("one customer's replay does not touch another's sessions", async () => {
    const victim = await signIn("victim");
    const bystander = await signIn("bystander");

    await renew(victim.cookie);
    await ageRevocations(victim.userId);
    await renew(victim.cookie);

    assert.equal(await liveTokens(victim.userId), 0);
    assert.ok(
      (await liveTokens(bystander.userId)) > 0,
      "an unrelated customer stays signed in"
    );
  });
});

describe("Refresh reuse — what is not an attack", () => {
  test("two tabs renewing at once does not sign the customer out", async () => {
    // Rotation is single-use, so one tab wins and the other arrives holding a
    // token spent milliseconds ago. Treating that as theft would punish
    // somebody for comparing two policies side by side.
    const { cookie, userId } = await signIn("race");

    const winner = await renew(cookie);
    assert.equal(winner.status, 200);

    // No ageing: the loser arrives inside the grace window.
    const loser = await renew(cookie);
    assert.equal(loser.status, 401, "the spent token is still refused");

    assert.ok(
      (await liveTokens(userId)) > 0,
      "but the session the winning tab established survives"
    );

    // And that session still renews normally afterwards.
    const afterwards = await renew(cookieHeader(winner));
    assert.equal(afterwards.status, 200);
  });

  test("a token that merely expired is not treated as reuse", async () => {
    const { cookie, userId } = await signIn("expired");
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await renew(cookie);
    assert.equal(res.status, 401);

    const replayEntry = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: "auth.refresh.replay" },
    });
    assert.equal(replayEntry, null, "an expired token is not evidence of anything");
  });

  test("a token we have never issued is refused without a sweep", async () => {
    // Nothing to sweep, and no user to attribute it to. It must not error.
    const forged = "aegis_refresh=" + "a".repeat(64);
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", forged)
      .set("Origin", ORIGIN);
    assert.equal(res.status, 401);
  });

  test("signing out then renewing does not error", async () => {
    // Logout revokes the token; a straggling renewal from a slow tab then
    // presents it. The customer is already signed out, so ending their
    // sessions is a no-op rather than a surprise.
    const { cookie } = await signIn("logout");
    await request(app).post("/api/v1/auth/logout").set("Cookie", cookie).set("Origin", ORIGIN);

    const res = await renew(cookie);
    assert.equal(res.status, 401);
  });
});
