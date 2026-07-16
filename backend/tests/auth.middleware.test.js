/**
 * Auth middleware — the gate in front of every protected route.
 *
 * Runs on node:test (Node's built-in runner) so the backend gains a suite
 * without a new dependency.
 *
 * The env module fails fast on a missing/weak JWT_SECRET and exits the process,
 * so the secret is set here before anything requires it. Tests must not depend
 * on a developer's local .env.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, mock, beforeEach } = require("node:test");
const jwt = require("jsonwebtoken");

const env = require("../src/config/env");
const { userRepository } = require("../src/repositories");
const { protect, restrictTo } = require("../src/middleware/auth.middleware");

const CUSTOMER = { id: "u-1", email: "a@b.com", role: "customer" };
const ADMIN = { id: "u-2", email: "c@d.com", role: "admin" };

const sign = (payload, secret = env.JWT_SECRET) =>
  jwt.sign(payload, secret, { expiresIn: "1h" });

const { COOKIE_NAME } = require("../src/utils/cookies");

/**
 * Minimal req the middleware can read. `token` is rendered into a real Cookie
 * header — readTokenFromCookies parses the raw header rather than a populated
 * req.cookies, so handing it an object silently looks like "no token".
 */
function makeReq({ token, headers = {}, user } = {}) {
  const merged = { ...headers };
  if (token !== undefined) {
    merged.cookie = `other=1; ${COOKIE_NAME}=${encodeURIComponent(token)}; last=2`;
  }
  return { headers: merged, user };
}

function capture() {
  const calls = [];
  const next = (err) => calls.push(err);
  next.errors = () => calls.filter(Boolean);
  next.passed = () => calls.length > 0 && calls.every((c) => !c);
  return next;
}

const run = (middleware, req, next) =>
  Promise.resolve(middleware(req, {}, next));

// ── restrictTo ────────────────────────────────────────────────────────────────

describe("restrictTo", () => {
  test("lets a permitted role through", () => {
    const next = capture();
    restrictTo("admin")(makeReq({ user: ADMIN }), {}, next);
    assert.equal(next.passed(), true);
  });

  test("rejects a role that was not listed", () => {
    const next = capture();
    restrictTo("admin")(makeReq({ user: CUSTOMER }), {}, next);
    const [err] = next.errors();
    assert.equal(err.statusCode, 403);
  });

  test("rejects an unauthenticated request rather than reading role off nothing", () => {
    const next = capture();
    restrictTo("admin")(makeReq(), {}, next);
    const [err] = next.errors();
    assert.equal(err.statusCode, 403);
  });

  test("accepts any one of several permitted roles", () => {
    for (const user of [ADMIN, { ...ADMIN, role: "superadmin" }]) {
      const next = capture();
      restrictTo("admin", "superadmin")(makeReq({ user }), {}, next);
      assert.equal(next.passed(), true, `${user.role} should pass`);
    }
  });

  test("a customer cannot reach an admin-only route", () => {
    const next = capture();
    restrictTo("admin", "superadmin")(makeReq({ user: CUSTOMER }), {}, next);
    assert.equal(next.errors()[0].statusCode, 403);
  });

  test("role matching is exact, not a prefix or substring", () => {
    /** "admin" must not open a route restricted to "superadmin". */
    const next = capture();
    restrictTo("superadmin")(makeReq({ user: ADMIN }), {}, next);
    assert.equal(next.errors()[0].statusCode, 403);
  });
});

// ── protect ───────────────────────────────────────────────────────────────────

describe("protect", () => {
  beforeEach(() => mock.restoreAll());

  test("rejects a request carrying no token at all", async () => {
    const next = capture();
    await run(protect, makeReq(), next);
    assert.equal(next.errors()[0].statusCode, 401);
  });

  test("accepts the httpOnly cookie", async () => {
    mock.method(userRepository, "findById", async () => CUSTOMER);
    const next = capture();
    const req = makeReq({ token: sign({ id: CUSTOMER.id }) });
    await run(protect, req, next);
    assert.equal(next.passed(), true);
    assert.equal(req.user.id, CUSTOMER.id);
  });

  test("still accepts a Bearer header for non-browser clients", async () => {
    mock.method(userRepository, "findById", async () => CUSTOMER);
    const next = capture();
    const req = makeReq({
      headers: { authorization: `Bearer ${sign({ id: CUSTOMER.id })}` },
    });
    await run(protect, req, next);
    assert.equal(next.passed(), true);
    assert.equal(req.user.id, CUSTOMER.id);
  });

  test("rejects a token signed with the wrong secret", async () => {
    const next = capture();
    const forged = sign({ id: CUSTOMER.id }, "attacker-key-attacker-key-attacker");
    await run(protect, makeReq({ token: forged }), next);
    assert.equal(next.errors()[0].statusCode, 401);
  });

  test("rejects a structurally invalid token", async () => {
    const next = capture();
    await run(protect, makeReq({ token: "not.a.jwt" }), next);
    assert.equal(next.errors()[0].statusCode, 401);
  });

  test("rejects an expired token", async () => {
    const next = capture();
    const stale = jwt.sign({ id: CUSTOMER.id }, env.JWT_SECRET, { expiresIn: "-1s" });
    await run(protect, makeReq({ token: stale }), next);
    assert.equal(next.errors()[0].statusCode, 401);
  });

  test("rejects a valid token whose user has since been deleted", async () => {
    mock.method(userRepository, "findById", async () => null);
    const next = capture();
    await run(protect, makeReq({ token: sign({ id: "gone" }) }), next);
    assert.equal(next.errors()[0].statusCode, 401);
  });

  test("identity comes from the database, never from the token body", async () => {
    /**
     * A token is a claim about *who* you are, not *what* you are. Trusting a
     * role encoded in it would let anyone mint an admin by re-signing — so the
     * middleware looks the user up and attaches the stored record.
     */
    mock.method(userRepository, "findById", async () => CUSTOMER);
    const next = capture();
    const req = makeReq({ token: sign({ id: CUSTOMER.id, role: "superadmin" }) });
    await run(protect, req, next);
    assert.equal(next.passed(), true);
    assert.equal(req.user.role, "customer");
  });

  test("looks the user up by the id inside the token", async () => {
    const findById = mock.method(userRepository, "findById", async () => CUSTOMER);
    await run(protect, makeReq({ token: sign({ id: "u-1" }) }), capture());
    assert.equal(findById.mock.calls[0].arguments[0], "u-1");
  });

  test("the cookie wins over a Bearer header", async () => {
    const findById = mock.method(userRepository, "findById", async () => CUSTOMER);
    const req = makeReq({
      token: sign({ id: "from-cookie" }),
      headers: { authorization: `Bearer ${sign({ id: "from-header" })}` },
    });
    await run(protect, req, capture());
    assert.equal(findById.mock.calls[0].arguments[0], "from-cookie");
  });
});
