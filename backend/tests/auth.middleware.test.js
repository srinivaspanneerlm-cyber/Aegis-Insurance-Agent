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
const { protect, requirePermission } = require("../src/middleware/auth.middleware");
const {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsForRole,
} = require("../src/auth/permissions");

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

// ── requirePermission ─────────────────────────────────────────────────────────

const SUPERADMIN = { id: "u-3", email: "e@f.com", role: "superadmin" };

describe("requirePermission", () => {
  test("lets a role holding the capability through", () => {
    const next = capture();
    requirePermission("lead.read")(makeReq({ user: ADMIN }), {}, next);
    assert.equal(next.passed(), true);
  });

  test("refuses a role that does not hold it", () => {
    const next = capture();
    requirePermission("lead.read")(makeReq({ user: CUSTOMER }), {}, next);
    assert.equal(next.errors()[0].statusCode, 403);
  });

  test("refuses an unauthenticated request rather than reading a role off nothing", () => {
    const next = capture();
    requirePermission("lead.read")(makeReq(), {}, next);
    assert.equal(next.errors()[0].statusCode, 403);
  });

  test("an unknown role grants nothing", () => {
    /**
     * A role written straight into the database, or a typo in one, must not be
     * able to open a door. The table is an allowlist, not a denylist.
     */
    const next = capture();
    const impostor = { ...ADMIN, role: "adminn" };
    requirePermission("lead.read")(makeReq({ user: impostor }), {}, next);
    assert.equal(next.errors()[0].statusCode, 403);
  });

  test("holding one capability does not imply a neighbouring one", () => {
    // An admin may work the pipeline but not destroy records in it. Under the
    // old role check these were the same question asked twice.
    const allowed = capture();
    requirePermission("lead.write")(makeReq({ user: ADMIN }), {}, allowed);
    assert.equal(allowed.passed(), true);

    const refused = capture();
    requirePermission("lead.delete")(makeReq({ user: ADMIN }), {}, refused);
    assert.equal(refused.errors()[0].statusCode, 403);
  });

  test("the refusal does not disclose which capability was missing", () => {
    // Naming it would map the permission model out for whoever is probing.
    const next = capture();
    requirePermission("platform.configure")(makeReq({ user: CUSTOMER }), {}, next);
    assert.ok(!/platform\.configure/.test(next.errors()[0].message));
  });
});

// ── the permission table itself ───────────────────────────────────────────────

describe("role bundles", () => {
  test("the conversion from roles preserved exactly who could do what", () => {
    // The five routes that used to name roles, and the roles they named. If a
    // bundle ever drifts, this is the test that should fail first.
    const before = {
      "lead.read": ["admin", "superadmin"],
      "lead.write": ["admin", "superadmin"],
      "lead.delete": ["superadmin"],
      "policy.write": ["admin", "superadmin"],
      "company.write": ["superadmin"],
      "analytics.read": ["admin", "superadmin"],
    };

    for (const [permission, allowedRoles] of Object.entries(before)) {
      for (const role of ["customer", "admin", "superadmin"]) {
        assert.equal(
          permissionsForRole(role).includes(permission),
          allowedRoles.includes(role),
          `${role} → ${permission}`
        );
      }
    }
  });

  test("a customer holds no capability at all", () => {
    // Their authority over their own records comes from userId scoping, not
    // from this table — and it must not look like it comes from here.
    assert.deepEqual(permissionsForRole("customer"), []);
  });

  test("superadmin holds every declared permission", () => {
    // Derived rather than listed, so a permission added later is not silently
    // withheld from the only role meant to have all of them.
    for (const permission of PERMISSIONS) {
      assert.ok(
        permissionsForRole("superadmin").includes(permission),
        `superadmin should hold ${permission}`
      );
    }
  });

  test("no bundle grants a permission that does not exist", () => {
    for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of granted) {
        assert.ok(PERMISSIONS.includes(permission), `${role} grants unknown ${permission}`);
      }
    }
  });

  test("an absent or empty role resolves to nothing", () => {
    for (const role of [null, undefined, ""]) {
      assert.deepEqual(permissionsForRole(role), []);
    }
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
