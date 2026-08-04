/**
 * End-to-end API tests: real Express app + middleware chain + Prisma, driven
 * through supertest. Runs against an ephemeral SQLite database provisioned from
 * the committed migrations, so it is self-contained (local + CI) and never
 * touches dev data.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

// Fresh throwaway DB for this test process (node --test isolates files in their
// own process, so this env does not leak into other suites).
const dbFile = path.join(os.tmpdir(), `aegis-itest-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");

const uniqueEmail = () => `itest-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
const PASSWORD = "verylongpassword123";

after(() => {
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

describe("API integration — auth lifecycle", () => {
  test("register → me → refresh → logout → refresh fails", async () => {
    const agent = request.agent(app);
    const email = uniqueEmail();

    const reg = await agent.post("/api/v1/auth/register").send({ name: "IT", email, password: PASSWORD });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.status, "success");
    assert.ok(reg.body.token, "access token returned in body");
    assert.equal(reg.body.data.user.email, email);
    assert.equal(reg.body.data.user.role, "customer", "public registration is always a customer");
    const cookies = reg.headers["set-cookie"] || [];
    assert.ok(cookies.some((c) => c.startsWith("aegis_token=")), "access cookie set");
    assert.ok(cookies.some((c) => c.startsWith("aegis_refresh=")), "refresh cookie set");
    // The frontend's route guard reads this before any page is rendered. It is
    // the only one of the three the frontend server ever sees: the access
    // cookie expires with its short-lived token, and the refresh cookie is
    // scoped to /api.
    assert.ok(cookies.some((c) => c.startsWith("aegis_session=")), "session cookie set");

    const me = await agent.get("/api/v1/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, email);

    const refreshed = await agent.post("/api/v1/auth/refresh");
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.token, "new access token issued");
    // Renewal re-issues the whole set, so a session that keeps renewing keeps
    // its guard cookie rather than quietly losing it and looking signed out.
    const renewedCookies = refreshed.headers["set-cookie"] || [];
    assert.ok(
      renewedCookies.some((c) => c.startsWith("aegis_session=")),
      "session cookie re-issued on renewal"
    );

    const out = await agent.post("/api/v1/auth/logout");
    assert.equal(out.status, 200);
    // Logout clears all three. A stale session cookie would keep sending a
    // signed-out visitor to pages the API then refuses.
    const clearedCookies = out.headers["set-cookie"] || [];
    for (const name of ["aegis_token", "aegis_refresh", "aegis_session"]) {
      assert.ok(
        clearedCookies.some((c) => c.startsWith(`${name}=;`)),
        `${name} cleared on logout`
      );
    }

    const afterLogout = await agent.post("/api/v1/auth/refresh");
    assert.equal(afterLogout.status, 401, "revoked refresh token is rejected");
    assert.equal(afterLogout.body.code, "UNAUTHORIZED");
  });

  test("the access token is short-lived, so a stolen one dies quickly", async () => {
    // The refresh token is the long-lived credential; the access token is not.
    // A month-long access token was what made the renewal machinery pointless.
    const jwt = require("jsonwebtoken");
    const agent = request.agent(app);
    const reg = await agent
      .post("/api/v1/auth/register")
      .send({ name: "TTL", email: uniqueEmail(), password: PASSWORD });

    const { iat, exp } = jwt.decode(reg.body.token);
    const lifetimeMinutes = (exp - iat) / 60;

    assert.ok(
      lifetimeMinutes <= 60,
      `access token lives ${lifetimeMinutes} minutes; expected an hour or less`
    );
  });

  test("login with wrong credentials → 401 with error envelope", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost@nowhere.test", password: "wrongpassword" });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "UNAUTHORIZED");
    assert.ok(res.body.requestId, "requestId present in error body");
  });
});

describe("API integration — authorization", () => {
  test("a customer is forbidden from the admin leads list (403 FORBIDDEN)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/register").send({ name: "Cust", email: uniqueEmail(), password: PASSWORD });
    const res = await agent.get("/api/v1/leads");
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FORBIDDEN");
  });

  test("an unauthenticated request to a protected route → 401", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    assert.equal(res.status, 401);
  });
});

describe("API integration — validation, versioning & envelope", () => {
  test("malformed :id → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/v1/policies/not-a-uuid");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
  });

  test("garbage pagination → 400", async () => {
    const res = await request(app).get("/api/v1/policies?page=abc");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
  });

  test("unknown route → 404", async () => {
    const res = await request(app).get("/api/v1/nope");
    assert.equal(res.status, 404);
  });

  test("versioned + aliased catalogue both 200; X-API-Version header set", async () => {
    const v1 = await request(app).get("/api/v1/policies");
    const alias = await request(app).get("/api/policies");
    assert.equal(v1.status, 200);
    assert.equal(alias.status, 200);
    assert.equal(v1.body.status, "success");
    assert.equal(v1.headers["x-api-version"], "v1");
  });

  test("inbound X-Request-Id is echoed", async () => {
    const res = await request(app).get("/api/v1/policies").set("X-Request-Id", "itest-trace-1");
    assert.equal(res.headers["x-request-id"], "itest-trace-1");
  });
});
