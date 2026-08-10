/**
 * The identity platform, driven through the real app.
 *
 * Four things are worth testing here and the rest follows from them: that a
 * realm decides who may come through which door, that a weak password is
 * refused before it becomes an account, that failing repeatedly stops being
 * useful, and that the flows which hand back control of an account — reset,
 * verification — cannot be replayed or pointed at somebody else.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000"; // one IP for the whole suite; 20/hour is right in production
process.env.WORKSPACE_EMAIL_DOMAINS = "aegis-corp.test,partner.test";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-identity-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { checkPassword } = require("../src/auth/password");
const { LOCKOUT_THRESHOLD } = require("../src/auth/lockout");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const GOOD_PASSWORD = "correct-horse-battery";

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

const uniqueEmail = (tag) =>
  `id-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

const register = (email, password = GOOD_PASSWORD, name = "Identity Subject") =>
  request(app).post("/api/v1/auth/register").set("Origin", ORIGIN).send({ name, email, password });

const login = (email, password, realm) =>
  request(app)
    .post("/api/v1/auth/login")
    .set("Origin", ORIGIN)
    .send({ email, password, ...(realm ? { realm } : {}) });

/** The raw token behind the most recent link of this kind. */
const latestToken = async (userId, purpose) => {
  const row = await prisma.verificationToken.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
  });
  return row;
};

// ── Password policy ──────────────────────────────────────────────────────────

describe("Password policy", () => {
  test("a short password never becomes an account", async () => {
    const res = await register(uniqueEmail("short"), "abc123");
    assert.equal(res.status, 400);
  });

  test("every problem is reported at once, not one per attempt", () => {
    // A form that surfaces one rule per submission teaches the rules by
    // attrition, and people answer by appending 1! until it stops complaining.
    const check = checkPassword("aaa", "CUSTOMER", {});
    assert.ok(check.problems.length >= 2, "several problems in one answer");
  });

  test("a long passphrase passes without needing symbols", () => {
    // The point of the whole policy. Length is what resists guessing; a
    // complexity maze reliably produces Password1! instead.
    assert.equal(checkPassword("the quick brown fox jumps", "CUSTOMER", {}).ok, true);
  });

  test("the platform realm demands more than the customer realm", () => {
    const passphrase = "chennai monsoon";
    assert.equal(checkPassword(passphrase, "CUSTOMER", {}).ok, true);
    assert.equal(checkPassword(passphrase, "PLATFORM", {}).ok, false);
  });

  test("your own email address is not a password", () => {
    const email = "priya.raman@example.com";
    assert.equal(checkPassword(`${email}extra`, "CUSTOMER", { email }).ok, false);
  });

  test("obvious and sequential passwords are refused", () => {
    assert.equal(checkPassword("password123", "CUSTOMER", {}).ok, false);
    assert.equal(checkPassword("abcdefghijkl", "CUSTOMER", {}).ok, false);
    assert.equal(checkPassword("aaaaaaaaaaaa", "CUSTOMER", {}).ok, false);
  });

  test("beyond bcrypt's 72 bytes is refused rather than silently truncated", () => {
    // Two different passwords hashing identically is a correctness hazard, not
    // only a cost one.
    assert.equal(checkPassword("x".repeat(80), "CUSTOMER", {}).ok, false);
  });
});

// ── Realms ───────────────────────────────────────────────────────────────────

describe("Realms — which door admits whom", () => {
  test("registration produces a customer in the customer realm", async () => {
    const res = await register(uniqueEmail("realm-new"));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.realm, "CUSTOMER");
    assert.equal(res.body.data.user.role, "CUSTOMER");
    assert.equal(res.body.data.realm, "CUSTOMER");
  });

  test("the response says where to send them next", async () => {
    // The client's next act is always to leave for that portal. Making it work
    // the destination out itself would put the routing rules in two places.
    const res = await register(uniqueEmail("realm-portal"));
    assert.ok(res.body.data.portalUrl, "a portal url travels with the session");
  });

  test("a customer is refused at the employee door", async () => {
    const email = uniqueEmail("realm-wrong");
    await register(email);

    const res = await login(email, GOOD_PASSWORD, "EMPLOYEE");
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "WRONG_REALM");
  });

  test("the refusal names the right portal rather than just saying no", async () => {
    // The account is fine; it belongs elsewhere. A bare denial would leave the
    // person with no idea what to do next.
    const email = uniqueEmail("realm-hint");
    await register(email);
    const res = await login(email, GOOD_PASSWORD, "EMPLOYEE");
    assert.match(res.body.message, /customer/i);
  });

  test("the platform realm refuses a provider sign-in outright", async () => {
    // Platform authority must not depend on an external provider's account
    // recovery — whoever can reset that Google account would otherwise reach
    // the platform's own controls.
    const res = await request(app)
      .post("/api/v1/auth/oauth/google")
      .set("Origin", ORIGIN)
      .send({ credential: "x".repeat(40), realm: "PLATFORM" });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "METHOD_NOT_ALLOWED");
  });

  test("an unknown realm is rejected by validation", async () => {
    const res = await login("someone@test.com", GOOD_PASSWORD, "SUPERUSER");
    assert.equal(res.status, 400);
  });

  test("a staff realm requires a verified email", async () => {
    const email = uniqueEmail("realm-unverified");
    const reg = await register(email);
    await prisma.user.update({
      where: { id: reg.body.data.user.id },
      data: { realm: "EMPLOYEE", role: "EMPLOYEE", emailVerifiedAt: null },
    });

    const res = await login(email, GOOD_PASSWORD, "EMPLOYEE");
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "EMAIL_NOT_VERIFIED");
  });

  test("a customer is not blocked by an unverified email", async () => {
    // Deliberate. Stopping someone at a mail client before they can read about
    // cover costs a customer; the verification gate belongs in front of actions
    // that matter, not in front of the whole product.
    const email = uniqueEmail("realm-customer-unverified");
    await register(email);
    const res = await login(email, GOOD_PASSWORD);
    assert.equal(res.status, 200);
  });
});

// ── Lockout ──────────────────────────────────────────────────────────────────

describe("Account lockout", () => {
  test("repeated failures stop being useful", async () => {
    // The per-IP limiter cannot see the attack that matters: one stolen
    // password list tried against one account from many addresses.
    const email = uniqueEmail("lock");
    await register(email);

    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      await login(email, "wrong-password-here");
    }

    const res = await login(email, GOOD_PASSWORD);
    assert.equal(res.status, 423);
    assert.equal(res.body.code, "ACCOUNT_LOCKED");
  });

  test("a lock expires on its own", async () => {
    // A lockout is itself a denial of service — anyone who knows an address can
    // trigger one. There must be no state an attacker creates that a customer
    // has to phone somebody to undo.
    const email = uniqueEmail("lock-expiry");
    const reg = await register(email);
    await prisma.user.update({
      where: { id: reg.body.data.user.id },
      data: { failedLoginAttempts: 99, lockedUntil: new Date(Date.now() - 1000) },
    });

    const res = await login(email, GOOD_PASSWORD);
    assert.equal(res.status, 200);
  });

  test("a successful sign-in clears the count", async () => {
    const email = uniqueEmail("lock-clear");
    const reg = await register(email);
    await login(email, "wrong-password-here");
    await login(email, GOOD_PASSWORD);

    const user = await prisma.user.findUnique({ where: { id: reg.body.data.user.id } });
    assert.equal(user.failedLoginAttempts, 0);
  });

  test("a locked account is not an existence oracle", async () => {
    // Locking is checked after the password, so a wrong password on a locked
    // account answers the same as a wrong password on any other.
    const email = uniqueEmail("lock-oracle");
    const reg = await register(email);
    await prisma.user.update({
      where: { id: reg.body.data.user.id },
      data: { lockedUntil: new Date(Date.now() + 600_000) },
    });

    const res = await login(email, "definitely-not-the-password");
    assert.equal(res.status, 401);
  });
});

// ── Login history ────────────────────────────────────────────────────────────

describe("Login history", () => {
  test("successes and failures are both recorded", async () => {
    const email = uniqueEmail("history");
    const reg = await register(email);
    await login(email, "wrong-password-here");
    await login(email, GOOD_PASSWORD);

    // Written fire-and-forget so a sign-in is never delayed by bookkeeping.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const events = await prisma.loginEvent.findMany({
      where: { userId: reg.body.data.user.id },
    });
    const outcomes = events.map((e) => e.outcome);
    assert.ok(outcomes.includes("SUCCESS"));
    assert.ok(outcomes.includes("BAD_CREDENTIALS"));
  });

  test("a customer can read their own history", async () => {
    const email = uniqueEmail("history-own");
    const reg = await register(email);
    const res = await request(app)
      .get("/api/v1/auth/login-history")
      .set("Cookie", cookieHeader(reg));

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.events));
  });
});

// ── Sessions ─────────────────────────────────────────────────────────────────

describe("Sittings", () => {
  test("signing in opens one, and it is listed", async () => {
    const email = uniqueEmail("session");
    const reg = await register(email);

    const res = await request(app).get("/api/v1/auth/sessions").set("Cookie", cookieHeader(reg));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.sessions.length, 1);
  });

  test("the list carries no token material", async () => {
    // Customer-facing data. A session list that leaked anything usable would be
    // a worse hazard than the one it exists to address.
    const email = uniqueEmail("session-safe");
    const reg = await register(email);
    const res = await request(app).get("/api/v1/auth/sessions").set("Cookie", cookieHeader(reg));

    const serialised = JSON.stringify(res.body);
    assert.ok(!/token/i.test(serialised), "no token field of any kind");
  });

  test("sign out everywhere ends all of them", async () => {
    const email = uniqueEmail("session-all");
    await register(email);
    const second = await login(email, GOOD_PASSWORD);
    const third = await login(email, GOOD_PASSWORD);

    const out = await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Cookie", cookieHeader(third))
      .set("Origin", ORIGIN);
    assert.equal(out.status, 200);

    // The other sitting's credential is dead too, not merely its session row.
    const renewed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(second))
      .set("Origin", ORIGIN);
    assert.equal(renewed.status, 401);
  });

  test("renewing keeps a sitting looking alive", async () => {
    // Rotation replaces the credential many times over one session, so renewal
    // is the only thing that can keep "last seen" honest. Without it an active
    // session looks abandoned, and any idle sweep built on that evicts live users.
    const email = uniqueEmail("session-touch");
    const reg = await register(email);
    const before = await prisma.authSession.findFirst({ where: { userId: reg.body.data.user.id } });

    await new Promise((resolve) => setTimeout(resolve, 30));
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(reg))
      .set("Origin", ORIGIN);

    const after = await prisma.authSession.findUnique({ where: { id: before.id } });
    assert.ok(after.lastSeenAt >= before.lastSeenAt);
  });
});

// ── Email verification ───────────────────────────────────────────────────────

describe("Email verification", () => {
  test("registering issues a verification token", async () => {
    const email = uniqueEmail("verify");
    const reg = await register(email);
    // Issued fire-and-forget: registration must not wait on a mail provider.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const token = await latestToken(reg.body.data.user.id, "EMAIL_VERIFICATION");
    assert.ok(token, "a token was issued");
  });

  test("only the hash is stored, never the value", async () => {
    // A token table readable from a backup would otherwise be a table of live
    // account takeovers.
    const email = uniqueEmail("verify-hash");
    const reg = await register(email);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const token = await latestToken(reg.body.data.user.id, "EMAIL_VERIFICATION");
    assert.match(token.tokenHash, /^[a-f0-9]{64}$/, "a sha-256 digest, not a token");
  });

  test("requesting a link answers the same for an unknown address", async () => {
    // Otherwise this endpoint is a list of who has an Aegis account.
    const known = uniqueEmail("verify-known");
    await register(known);

    const a = await request(app)
      .post("/api/v1/auth/verify-email/request")
      .set("Origin", ORIGIN)
      .send({ email: known });
    const b = await request(app)
      .post("/api/v1/auth/verify-email/request")
      .set("Origin", ORIGIN)
      .send({ email: "nobody-at-all@nowhere.test" });

    assert.equal(a.status, b.status);
    assert.equal(a.body.message, b.body.message);
  });

  test("an invalid token is refused", async () => {
    const res = await request(app)
      .post("/api/v1/auth/verify-email")
      .set("Origin", ORIGIN)
      .send({ token: "n".repeat(43) });
    assert.equal(res.status, 400);
  });

  test("a link mailed to an address the account has since moved on from no longer confirms it", async () => {
    // Task 9.2. Same reasoning as password reset: the token proves control of
    // the address it was issued for, not of whatever address the account
    // holds now.
    const email = uniqueEmail("verify-moved-from");
    const reg = await register(email);

    const crypto = require("crypto");
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
        userId: reg.body.data.user.id,
        email,
        purpose: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    await prisma.user.update({
      where: { id: reg.body.data.user.id },
      data: { email: uniqueEmail("verify-moved-to") },
    });

    const res = await request(app)
      .post("/api/v1/auth/verify-email")
      .set("Origin", ORIGIN)
      .send({ token: raw });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_TOKEN");

    const stillUnverified = await prisma.user.findUnique({
      where: { id: reg.body.data.user.id },
    });
    assert.equal(stillUnverified.emailVerifiedAt, null, "the new address must not be confirmed by an old link");
  });
});

// ── Password reset ───────────────────────────────────────────────────────────

describe("Password reset", () => {
  const requestReset = (email) =>
    request(app).post("/api/v1/auth/forgot-password").set("Origin", ORIGIN).send({ email });

  const submitReset = (token, password) =>
    request(app).post("/api/v1/auth/reset-password").set("Origin", ORIGIN).send({ token, password });

  test("asking answers identically for an address we do not know", async () => {
    const known = uniqueEmail("reset-known");
    await register(known);

    const a = await requestReset(known);
    const b = await requestReset("stranger@nowhere.test");

    assert.equal(a.status, b.status);
    assert.equal(a.body.message, b.body.message);
  });

  test("a second request retires the first link", async () => {
    // Otherwise every link ever sent stays live until it expires, and an old
    // forwarded email is a working account takeover.
    const email = uniqueEmail("reset-retire");
    const reg = await register(email);

    await requestReset(email);
    const first = await latestToken(reg.body.data.user.id, "PASSWORD_RESET");
    await requestReset(email);

    const retired = await prisma.verificationToken.findUnique({ where: { id: first.id } });
    assert.ok(retired.consumedAt, "the earlier link no longer works");
  });

  test("a reset ends every existing sitting", async () => {
    // Whoever prompted the reset may be holding a live session right now —
    // that is usually why a person resets. A new password that leaves the
    // intruder signed in has achieved nothing.
    const email = uniqueEmail("reset-sessions");
    const reg = await register(email);
    const intruder = await login(email, GOOD_PASSWORD);

    // The service hashes the raw token, so a test has to mint one the same way.
    const crypto = require("crypto");
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
        userId: reg.body.data.user.id,
        email,
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    const res = await submitReset(raw, "a completely different phrase");
    assert.equal(res.status, 200);

    const renewed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(intruder))
      .set("Origin", ORIGIN);
    assert.equal(renewed.status, 401, "the intruder's session is gone too");
  });

  test("a reset token cannot be spent twice", async () => {
    const email = uniqueEmail("reset-replay");
    const reg = await register(email);

    const crypto = require("crypto");
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
        userId: reg.body.data.user.id,
        email,
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    assert.equal((await submitReset(raw, "first new passphrase here")).status, 200);
    assert.equal((await submitReset(raw, "second new passphrase here")).status, 400);
  });

  test("a verification token is not a reset token", async () => {
    // Same table, different consequence. Presenting one where the other is
    // expected must not work, and it does not happen by accident.
    const email = uniqueEmail("reset-purpose");
    const reg = await register(email);

    const crypto = require("crypto");
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
        userId: reg.body.data.user.id,
        email,
        purpose: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    assert.equal((await submitReset(raw, "a perfectly fine passphrase")).status, 400);
  });

  test("the new password still has to meet the policy", async () => {
    const email = uniqueEmail("reset-weak");
    const reg = await register(email);

    const crypto = require("crypto");
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
        userId: reg.body.data.user.id,
        email,
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    assert.equal((await submitReset(raw, "short")).status, 400);
  });

  test("a link mailed to an address the account has since moved on from no longer works", async () => {
    // Task 9.2. The token is bound to the address it was issued for — if the
    // account's email changed in between, a link to the old mailbox must not
    // still control the account. A forwarded or intercepted old email is
    // exactly the scenario this closes.
    const email = uniqueEmail("reset-moved-from");
    const reg = await register(email);

    const crypto = require("crypto");
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
        userId: reg.body.data.user.id,
        email, // bound to the address at issue time
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    // The account's address changes before the link is ever used.
    await prisma.user.update({
      where: { id: reg.body.data.user.id },
      data: { email: uniqueEmail("reset-moved-to") },
    });

    const res = await submitReset(raw, "a perfectly fine passphrase");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_TOKEN");
  });
});

// ── Change password ──────────────────────────────────────────────────────────

describe("Changing a password from inside a session", () => {
  const change = (cookie, currentPassword, newPassword) =>
    request(app)
      .patch("/api/v1/auth/password")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ currentPassword, newPassword });

  test("the current password is required even though they are signed in", async () => {
    // Without it, a borrowed unlocked laptop is a permanent account takeover.
    const email = uniqueEmail("change-current");
    const reg = await register(email);

    const res = await change(cookieHeader(reg), "not-the-current-one", "a brand new passphrase");
    assert.equal(res.status, 401);
  });

  test("a successful change keeps the caller signed in", async () => {
    // Ending the session of the person who just secured their account teaches
    // people not to secure their accounts.
    const email = uniqueEmail("change-keeps");
    const reg = await register(email);

    const res = await change(cookieHeader(reg), GOOD_PASSWORD, "a brand new passphrase");
    assert.equal(res.status, 200);

    const renewed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(res))
      .set("Origin", ORIGIN);
    assert.equal(renewed.status, 200);
  });

  test("but evicts everybody else", async () => {
    const email = uniqueEmail("change-evicts");
    const reg = await register(email);
    const elsewhere = await login(email, GOOD_PASSWORD);

    await change(cookieHeader(reg), GOOD_PASSWORD, "another brand new phrase");

    const renewed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(elsewhere))
      .set("Origin", ORIGIN);
    assert.equal(renewed.status, 401);
  });

  test("the new password must actually be new", async () => {
    const email = uniqueEmail("change-same");
    const reg = await register(email);
    const res = await change(cookieHeader(reg), GOOD_PASSWORD, GOOD_PASSWORD);
    assert.equal(res.status, 400);
  });

  test("it is refused without a session", async () => {
    const res = await request(app)
      .patch("/api/v1/auth/password")
      .set("Origin", ORIGIN)
      .send({ currentPassword: GOOD_PASSWORD, newPassword: "a brand new passphrase" });
    assert.equal(res.status, 401);
  });
});
