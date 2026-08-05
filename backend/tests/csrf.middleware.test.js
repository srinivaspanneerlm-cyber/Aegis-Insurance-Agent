/**
 * Cross-site request forgery defence, driven through the real app.
 *
 * The question every case here asks is the same one the middleware asks: could
 * another website have caused this request? The cookie is `SameSite=None` in
 * production, so the browser would happily attach it on that site's behalf —
 * which makes "where did this come from" the only thing standing in the way.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-csrf-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");

const BROWSER_ORIGIN = "http://localhost:3000";
const ATTACKER_ORIGIN = "https://not-aegis.example";
const PASSWORD = "csrf-test-password-123";

after(() => {
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
});

/** A signed-in customer, and the cookie header a browser would resend. */
const signIn = async () => {
  const email = `csrf-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", BROWSER_ORIGIN)
    .send({ name: "CSRF Subject", email, password: PASSWORD });
  assert.equal(res.status, 201, "registration should succeed");
  const cookies = res.headers["set-cookie"] || [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
};

describe("CSRF — a request another site could have made", () => {
  test("is refused when it names the attacker's origin", async () => {
    const cookie = await signIn();
    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Cookie", cookie)
      .set("Origin", ATTACKER_ORIGIN)
      .send({ preferredLanguage: "en", insuranceInterests: ["health"] });

    assert.equal(res.status, 403);
  });

  test("is refused when it names no origin at all", async () => {
    // A browser always says where a cross-site request came from. Silence means
    // we cannot tell, and the customer's session is not something to guess with.
    const cookie = await signIn();
    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Cookie", cookie)
      .send({ preferredLanguage: "en", insuranceInterests: ["health"] });

    assert.equal(res.status, 403);
  });

  test("is refused when only the Referer is foreign", async () => {
    const cookie = await signIn();
    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Cookie", cookie)
      .set("Referer", `${ATTACKER_ORIGIN}/lure`)
      .send({ preferredLanguage: "en", insuranceInterests: ["health"] });

    assert.equal(res.status, 403);
  });

  test("does not leak whether the action would have worked", async () => {
    const cookie = await signIn();
    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Cookie", cookie)
      .set("Origin", ATTACKER_ORIGIN)
      .send({ preferredLanguage: "not-a-real-language", insuranceInterests: [] });

    // Stopped on the way in — never validated, never reached the profile.
    assert.equal(res.status, 403);
  });
});

describe("CSRF — a request the portal made", () => {
  test("passes when it comes from an allowed origin", async () => {
    const cookie = await signIn();
    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Cookie", cookie)
      .set("Origin", BROWSER_ORIGIN)
      .send({ preferredLanguage: "en", insuranceInterests: ["health"] });

    assert.equal(res.status, 200);
  });

  test("passes on a Referer from an allowed origin when Origin is absent", async () => {
    const cookie = await signIn();
    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Cookie", cookie)
      .set("Referer", `${BROWSER_ORIGIN}/onboarding`)
      .send({ preferredLanguage: "en", insuranceInterests: ["health"] });

    assert.equal(res.status, 200);
  });
});

describe("CSRF — what the guard deliberately ignores", () => {
  test("reading is never blocked, whoever asks", async () => {
    // Forgery is about causing an action. A GET changes nothing, and gating
    // navigation on a header would break ordinary browsing.
    const cookie = await signIn();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie)
      .set("Origin", ATTACKER_ORIGIN);

    assert.equal(res.status, 200);
  });

  test("a Bearer client is unaffected — it has no cookie to ride", async () => {
    // An attacker's page cannot make the browser attach this header, so there
    // is nothing here to forge. Blocking it would break non-browser clients for
    // no gain.
    const email = `csrf-bearer-${Date.now()}@test.com`;
    const reg = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", BROWSER_ORIGIN)
      .send({ name: "API Client", email, password: PASSWORD });
    const token = reg.body.token;

    const res = await request(app)
      .patch("/api/v1/auth/me/onboarding")
      .set("Authorization", `Bearer ${token}`)
      .send({ preferredLanguage: "en", insuranceInterests: ["health"] });

    assert.equal(res.status, 200);
  });

  test("signing in is not gated — there is no session to ride yet", async () => {
    const email = `csrf-fresh-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Newcomer", email, password: PASSWORD });

    assert.equal(res.status, 201);
  });
});

describe("CSRF — the refresh cookie counts too", () => {
  test("a forged renewal cannot rotate someone's session", async () => {
    // The refresh cookie is a credential the browser attaches on its own, so
    // riding it is the same attack. Left open, another site could spend a
    // customer's single-use refresh token and strand their other tabs.
    const cookie = await signIn();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie)
      .set("Origin", ATTACKER_ORIGIN);

    assert.equal(res.status, 403);
  });

  test("the portal's own renewal still works", async () => {
    const cookie = await signIn();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie)
      .set("Origin", BROWSER_ORIGIN);

    assert.equal(res.status, 200);
  });
});
