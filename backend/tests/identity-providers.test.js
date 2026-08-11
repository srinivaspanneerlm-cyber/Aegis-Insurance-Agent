/**
 * Identity provider registry, driven through the real app.
 *
 * The thing worth testing here is not "does Google work" — that is Google's
 * library. It is the account-matching rule: given an identity a provider has
 * vouched for, which Aegis account does the customer land on? Getting that
 * wrong in either direction is serious. Match too eagerly and one person is
 * handed another's policies; match too reluctantly and a returning customer
 * gets an empty duplicate account and cannot find their own cover.
 *
 * A stub provider is registered for these tests, which is also the proof that
 * the registry is a real extension point: adding Microsoft or an insurer's
 * OIDC looks exactly like this.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-idp-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");

const { registerIdentityProvider } = require("../src/auth/providers");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "idp-test-password-123";

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

/**
 * A stand-in provider. The credential is a JSON blob describing the identity it
 * should vouch for, so a test can say "this provider verified this person"
 * without a network call or a real signing key.
 */
registerIdentityProvider({
  id: "stub",
  label: "Stub IdP",
  isConfigured: true,
  async verify(credential) {
    try {
      const claims = JSON.parse(credential);
      if (claims.reject) return null;
      return {
        provider: "stub",
        subject: claims.subject,
        email: String(claims.email).toLowerCase(),
        displayName: claims.name ?? null,
        pictureUrl: claims.picture ?? null,
      };
    } catch {
      return null;
    }
  },
});

/** A provider that is registered but this deployment cannot use. */
registerIdentityProvider({
  id: "unconfigured",
  label: "Unconfigured IdP",
  isConfigured: false,
  async verify() {
    throw new Error("must never be called — an unconfigured provider cannot verify");
  },
});

const signInWith = (claims, providerId = "stub") =>
  request(app)
    .post(`/api/v1/auth/oauth/${providerId}`)
    .set("Origin", ORIGIN)
    .send({ credential: JSON.stringify(claims) });

const uniqueEmail = (tag) =>
  `idp-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

describe("Identity registry — which provider answers", () => {
  test("an unknown provider is refused", async () => {
    const res = await signInWith({ subject: "s-1", email: uniqueEmail("x") }, "not-a-provider");
    assert.equal(res.status, 400);
  });

  test("a registered but unconfigured provider is refused before it verifies", async () => {
    // Its verify() throws if reached. A 400 rather than a 500 proves the
    // registry stopped short of calling it.
    const res = await signInWith({ subject: "s-2", email: uniqueEmail("y") }, "unconfigured");
    assert.equal(res.status, 400);
  });

  test("only configured providers are offered to the sign-in screen", async () => {
    const res = await request(app).get("/api/v1/auth/providers");
    assert.equal(res.status, 200);
    const ids = res.body.data.providers.map((p) => p.id);
    assert.ok(ids.includes("stub"), "a configured provider is listed");
    assert.ok(
      !ids.includes("unconfigured"),
      "a button that cannot work must not be offered"
    );
  });

  test("a credential the provider will not vouch for is a 401", async () => {
    const res = await signInWith({ reject: true, subject: "s-3", email: uniqueEmail("z") });
    assert.equal(res.status, 401);
  });
});

describe("Identity registry — which account the customer lands on", () => {
  test("a first sign-in creates the account and links the identity", async () => {
    const email = uniqueEmail("new");
    const res = await signInWith({ subject: "new-subject-1", email, name: "First Timer" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, email);
    assert.equal(res.body.data.user.role, "CUSTOMER", "never anything but customer");

    const link = await prisma.linkedIdentity.findUnique({
      where: { provider_subject: { provider: "stub", subject: "new-subject-1" } },
    });
    assert.ok(link, "the identity is linked, not just used once");
    assert.equal(link.userId, res.body.data.user.id);
  });

  test("signing in again returns the same account, not a duplicate", async () => {
    const email = uniqueEmail("repeat");
    const first = await signInWith({ subject: "repeat-subject", email });
    const second = await signInWith({ subject: "repeat-subject", email });

    assert.equal(second.status, 200);
    assert.equal(second.body.data.user.id, first.body.data.user.id);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });

  test("the link survives the customer changing their email at the provider", async () => {
    // The whole reason the subject is the durable key. Matching on email would
    // strand this person outside the account holding their policies.
    const original = uniqueEmail("moved");
    const first = await signInWith({ subject: "moving-subject", email: original });

    const changed = uniqueEmail("moved-new");
    const second = await signInWith({ subject: "moving-subject", email: changed });

    assert.equal(second.status, 200);
    assert.equal(
      second.body.data.user.id,
      first.body.data.user.id,
      "same person, same account"
    );
  });

  test("a password account is adopted, not duplicated", async () => {
    // Someone who registered with a password and later taps the provider
    // button must land on the account that already holds their history.
    const email = uniqueEmail("adopt");
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", ORIGIN)
      .send({ name: "Password First", email, password: PASSWORD });
    assert.equal(registered.status, 201);

    const viaProvider = await signInWith({ subject: "adopt-subject", email });

    assert.equal(viaProvider.status, 200);
    assert.equal(viaProvider.body.data.user.id, registered.body.data.user.id);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });

  test("one external identity cannot be claimed by two accounts", async () => {
    // The unique index is the barrier. Without it, a second Aegis user could
    // attach the same provider account and inherit a way in.
    const email = uniqueEmail("unique");
    await signInWith({ subject: "sole-subject", email });

    const links = await prisma.linkedIdentity.count({
      where: { provider: "stub", subject: "sole-subject" },
    });
    assert.equal(links, 1);
  });

  test("a deactivated account is refused even with a valid identity", async () => {
    const email = uniqueEmail("deactivated");
    const created = await signInWith({ subject: "deactivated-subject", email });
    await prisma.user.update({
      where: { id: created.body.data.user.id },
      data: { isActive: false },
    });

    const again = await signInWith({ subject: "deactivated-subject", email });
    assert.equal(again.status, 403);
  });

  test("a soft-deleted account is refused even with a valid identity", async () => {
    // Task 9.8. The password path already closed this; the provider path had
    // its own, separate isActive check and needed the same addition.
    const email = uniqueEmail("deleted");
    const created = await signInWith({ subject: "deleted-subject", email });
    await prisma.user.update({
      where: { id: created.body.data.user.id },
      data: { deletedAt: new Date() },
    });

    const again = await signInWith({ subject: "deleted-subject", email });
    assert.equal(again.status, 403);
  });

  test("a provider-created account cannot be signed into with a password", async () => {
    // The password it was given is random and never disclosed, so this account
    // is provider-only by construction rather than by a flag.
    const email = uniqueEmail("nopassword");
    await signInWith({ subject: "nopassword-subject", email });

    const attempt = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", ORIGIN)
      .send({ email, password: PASSWORD });

    assert.equal(attempt.status, 401);
  });

  test("the session it issues is an ordinary one", async () => {
    // A provider sign-in is not a lesser session: same cookies, and /auth/me
    // answers for it exactly as it does after a password login.
    const email = uniqueEmail("session");
    const res = await signInWith({ subject: "session-subject", email });
    const cookie = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

    const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, email);
  });
});

describe("Identity registry — registering", () => {
  test("an id already in use is refused rather than silently replaced", async () => {
    assert.throws(
      () =>
        registerIdentityProvider({
          id: "google",
          label: "Impostor",
          isConfigured: true,
          verify: async () => null,
        }),
      /already registered/
    );
  });
});
