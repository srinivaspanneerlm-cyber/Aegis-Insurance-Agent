/**
 * First-time onboarding, end-to-end: real Express app + middleware + Prisma,
 * driven through supertest against an ephemeral SQLite database.
 *
 * The values stored here decide which advisor a customer meets, so the point of
 * these tests is less "does it save" and more "can anything other than an
 * allowlisted value ever reach the profile".
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-onboard-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");

// A real browser states where it came from, and the CSRF guard requires that on
// any state-changing request carrying a session cookie. These agents hold
// cookies, so they have to look like the browser they stand in for.
const BROWSER_ORIGIN = "http://localhost:3000";

after(() => {
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const signUp = async () => {
  const agent = request.agent(app).set("Origin", BROWSER_ORIGIN);
  const email = `onb-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const reg = await agent.post("/api/v1/auth/register").send({
    name: "Priya Raman",
    email,
    password: "verylongpassword123",
  });
  assert.equal(reg.status, 201);
  return { agent, email, user: reg.body.data.user };
};

const ONBOARD = "/api/v1/auth/me/onboarding";
const VALID = { preferredLanguage: "ta", insuranceInterests: ["health", "motor"] };

describe("onboarding — access", () => {
  test("refuses an unauthenticated caller", async () => {
    const res = await request(app).patch(ONBOARD).send(VALID);
    assert.equal(res.status, 401);
  });

  test("a new account starts un-onboarded", async () => {
    const { user } = await signUp();
    assert.equal(user.onboardedAt, null, "the client routes on this being null");
    assert.ok(user.lastLoginAt, "registering signs you in, so it counts as a login");
  });
});

describe("onboarding — completing it", () => {
  test("stores both answers and stamps the completion time", async () => {
    const { agent } = await signUp();
    const res = await agent.patch(ONBOARD).send(VALID);

    assert.equal(res.status, 200);
    const user = res.body.data.user;
    assert.equal(user.preferredLanguage, "ta");
    assert.deepEqual(JSON.parse(user.insuranceInterests), ["health", "motor"]);
    assert.ok(user.onboardedAt, "onboardedAt is set, so they are never asked again");
  });

  test("never returns the password hash", async () => {
    const { agent } = await signUp();
    const res = await agent.patch(ONBOARD).send(VALID);
    assert.equal(res.body.data.user.password, undefined);
  });

  test("the stamp survives — /me agrees afterwards", async () => {
    const { agent } = await signUp();
    await agent.patch(ONBOARD).send(VALID);

    const me = await agent.get("/api/v1/auth/me");
    assert.equal(me.status, 200);
    assert.ok(me.body.data.user.onboardedAt);
    assert.equal(me.body.data.user.preferredLanguage, "ta");
  });

  test("answers can be changed by submitting again", async () => {
    const { agent } = await signUp();
    await agent.patch(ONBOARD).send(VALID);
    const res = await agent
      .patch(ONBOARD)
      .send({ preferredLanguage: "en", insuranceInterests: ["travel"] });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.preferredLanguage, "en");
  });
});

describe("onboarding — what it refuses to store", () => {
  const reject = async (payload, why) => {
    const { agent } = await signUp();
    const res = await agent.patch(ONBOARD).send(payload);
    assert.equal(res.status, 400, why);
    return res;
  };

  test("a language outside the allowlist", async () => {
    await reject({ ...VALID, preferredLanguage: "klingon" }, "unknown language");
  });

  test("free text where an interest id belongs", async () => {
    await reject(
      { ...VALID, insuranceInterests: ["<script>alert(1)</script>"] },
      "arbitrary text must never reach the profile"
    );
  });

  test("an empty set of interests", async () => {
    await reject({ ...VALID, insuranceInterests: [] }, "at least one is required");
  });

  test("more interests than the cap allows", async () => {
    await reject(
      { ...VALID, insuranceInterests: ["health", "motor", "travel", "property", "miscellaneous", "health"] },
      "over the cap"
    );
  });

  test("the same interest twice", async () => {
    await reject({ ...VALID, insuranceInterests: ["health", "health"] }, "duplicates");
  });

  test("a non-array in the interests field", async () => {
    await reject({ ...VALID, insuranceInterests: "health" }, "must be a list");
  });

  test("a rejected attempt leaves the profile untouched", async () => {
    const { agent } = await signUp();
    await agent.patch(ONBOARD).send({ preferredLanguage: "klingon", insuranceInterests: ["health"] });

    const me = await agent.get("/api/v1/auth/me");
    assert.equal(me.body.data.user.onboardedAt, null, "a failed attempt must not mark them done");
    assert.equal(me.body.data.user.preferredLanguage, null);
  });
});

describe("onboarding — it is always the caller's own", () => {
  test("a userId in the body cannot redirect the write", async () => {
    const victim = await signUp();
    const attacker = await signUp();

    const res = await attacker.agent
      .patch(ONBOARD)
      .send({ ...VALID, userId: victim.user.id, id: victim.user.id });
    assert.equal(res.status, 200);

    // The attacker onboarded themselves; the victim is untouched.
    assert.equal(res.body.data.user.id, attacker.user.id);
    const victimMe = await victim.agent.get("/api/v1/auth/me");
    assert.equal(victimMe.body.data.user.onboardedAt, null);
  });
});

describe("last login", () => {
  test("is recorded when a session starts", async () => {
    const { agent, email } = await signUp();
    const login = await agent
      .post("/api/v1/auth/login")
      .send({ email, password: "verylongpassword123" });

    assert.equal(login.status, 200);
    assert.ok(login.body.data.user.lastLoginAt, "lastLoginAt is stamped on sign-in");
  });
});
