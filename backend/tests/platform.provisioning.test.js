/**
 * Provisioning a tenant's staff.
 *
 * Self-registration is customer-only by design — a form is not an acceptable
 * barrier into a staff realm — and until this landed nothing else could create
 * a staff account either, so the only way into an ENTERPRISE realm was a direct
 * database write.
 *
 * The properties worth pinning are the ones that would let somebody in who
 * should not be: who may provision, into which organisation, against which seat
 * count, and whether the invitation token can be replayed.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, before, after } = require("node:test");

const { PrismaClient } = require("@prisma/client");
const { platformService } = require("../src/services/platform.service");
const { consumeToken } = require("../src/auth/verification");
const { permissionsForRole } = require("../src/auth/permissions");

const prisma = new PrismaClient();
const TAG = `prov-${Date.now()}`;
const made = { orgs: [], users: [] };

async function org(slug, { status = "ACTIVE", seats = 5, licence = true } = {}) {
  const o = await prisma.organization.create({
    data: {
      slug: `${TAG}-${slug}`,
      name: `${slug} Ltd`,
      status,
      ...(licence ? { license: { create: { plan: "GROWTH", seats } } } : {}),
    },
  });
  made.orgs.push(o.id);
  return o;
}

let operator;

before(async () => {
  operator = await prisma.user.create({
    data: {
      name: "Operator", email: `${TAG}-op@example.com`, password: "x",
      realm: "PLATFORM", role: "PLATFORM_ADMIN",
    },
  });
  made.users.push(operator.id);
});

after(async () => {
  await prisma.verificationToken.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: made.users } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.license.deleteMany({ where: { organizationId: { in: made.orgs } } });
  await prisma.organization.deleteMany({ where: { id: { in: made.orgs } } });
  await prisma.$disconnect();
});

describe("who may provision", () => {
  test("the route is the only caller, and it sits behind PLATFORM + platform.configure", () => {
    const fs = require("node:fs");
    const routes = fs.readFileSync("src/routes/platform.routes.ts", "utf8");
    assert.match(routes, /router\.use\(protect, requireRealm\("PLATFORM"\), requirePermission\("platform\.configure"\)\)/);
    assert.match(routes, /"\/organizations\/:id\/members",\s*\n\s*requireFreshAuth,/);
    // No role outside PLATFORM_ADMIN holds platform.configure.
    for (const role of ["ENTERPRISE_ADMIN", "EMPLOYEE", "SUPPORT", "OPERATIONS", "COMPLIANCE", "CUSTOMER"]) {
      assert.ok(
        !permissionsForRole(role).includes("platform.configure"),
        `${role} must not hold platform.configure`
      );
    }
  });
});

describe("provisioning succeeds", () => {
  test("creates an ENTERPRISE_ADMIN bound to the organisation", async () => {
    const o = await org("ok");
    const { user, invitation } = await platformService.provisionMember(
      o.id, { email: `${TAG}-admin@example.com`, name: "Aegis Admin" }, operator.id
    );
    made.users.push(user.id);

    assert.equal(user.realm, "ENTERPRISE");
    assert.equal(user.role, "ENTERPRISE_ADMIN");
    assert.equal(user.organizationId, o.id);
    assert.equal(invitation.sentTo, `${TAG}-admin@example.com`);
    assert.ok(invitation.expiresAt instanceof Date);
  });

  test("no usable password is set, and none is returned", async () => {
    const o = await org("nopw");
    const { user, invitation } = await platformService.provisionMember(
      o.id, { email: `${TAG}-nopw@example.com` }, operator.id
    );
    made.users.push(user.id);

    assert.equal(invitation.token, undefined, "a raw token must never be returned");
    assert.equal(user.password, undefined, "no password field may be returned");
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(row.password && row.password.startsWith("$2"), "stored as a bcrypt hash, not plaintext");
  });

  test("the address is vouched for, so the enterprise realm admits them", async () => {
    const o = await org("verified");
    const { user } = await platformService.provisionMember(
      o.id, { email: `${TAG}-verified@example.com` }, operator.id
    );
    made.users.push(user.id);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(row.emailVerifiedAt, "the enterprise realm refuses an unverified address");
  });
});

describe("provisioning is refused", () => {
  test("a duplicate email", async () => {
    const o = await org("dup");
    const first = await platformService.provisionMember(o.id, { email: `${TAG}-dup@example.com` }, operator.id);
    made.users.push(first.user.id);
    await assert.rejects(
      () => platformService.provisionMember(o.id, { email: `${TAG}-dup@example.com` }, operator.id),
      /already exists/
    );
  });

  test("an organisation that does not exist", async () => {
    await assert.rejects(
      () => platformService.provisionMember("no-such-org", { email: `${TAG}-x@example.com` }, operator.id),
      /does not exist/
    );
  });

  test("a suspended organisation", async () => {
    const o = await org("susp", { status: "SUSPENDED" });
    await assert.rejects(
      () => platformService.provisionMember(o.id, { email: `${TAG}-susp@example.com` }, operator.id),
      /suspended/
    );
  });

  test("an organisation with no licence", async () => {
    const o = await org("nolic", { licence: false });
    await assert.rejects(
      () => platformService.provisionMember(o.id, { email: `${TAG}-nolic@example.com` }, operator.id),
      /no licence/
    );
  });

  test("a full seat count", async () => {
    const o = await org("seats", { seats: 1 });
    const first = await platformService.provisionMember(o.id, { email: `${TAG}-s1@example.com` }, operator.id);
    made.users.push(first.user.id);
    await assert.rejects(
      () => platformService.provisionMember(o.id, { email: `${TAG}-s2@example.com` }, operator.id),
      /seat\(s\) are in use/
    );
  });

  test("a role outside the tenant set — PLATFORM_ADMIN above all", async () => {
    const o = await org("role");
    await assert.rejects(
      () => platformService.provisionMember(o.id, { email: `${TAG}-r@example.com`, role: "PLATFORM_ADMIN" }, operator.id),
      /Role must be one of/
    );
  });

  test("a malformed email", async () => {
    const o = await org("mail");
    await assert.rejects(
      () => platformService.provisionMember(o.id, { email: "not-an-email" }, operator.id),
      /valid email address/
    );
  });
});

describe("the invitation token", () => {
  test("is stored only as a hash, and never in the clear", async () => {
    const o = await org("tok");
    const { user } = await platformService.provisionMember(o.id, { email: `${TAG}-tok@example.com` }, operator.id);
    made.users.push(user.id);

    const row = await prisma.verificationToken.findFirst({ where: { userId: user.id } });
    assert.equal(row.purpose, "PASSWORD_RESET");
    assert.match(row.tokenHash, /^[a-f0-9]{64}$/, "a SHA-256 hex digest, not the token");
    assert.equal(row.consumedAt, null);
    // One hour, from the existing TOKEN_TTL_MS.
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime();
    assert.ok(ttl > 55 * 60_000 && ttl <= 60 * 60_000, `unexpected ttl ${ttl}ms`);
  });

  test("is single-use: a second spend of the same token is refused", async () => {
    const o = await org("once");
    const { user } = await platformService.provisionMember(o.id, { email: `${TAG}-once@example.com` }, operator.id);
    made.users.push(user.id);

    // Re-issue through the same helper so the raw value is in hand — issuing
    // retires the previous one, which is itself the behaviour being relied on.
    const { issueToken } = require("../src/auth/verification");
    const { token } = await issueToken(user.id, `${TAG}-once@example.com`, "PASSWORD_RESET");

    const first = await consumeToken(token, "PASSWORD_RESET", `${TAG}-once@example.com`);
    assert.equal(first.ok, true);
    const second = await consumeToken(token, "PASSWORD_RESET", `${TAG}-once@example.com`);
    assert.equal(second.ok, false);
    assert.equal(second.reason, "USED");
  });

  test("expires", async () => {
    const o = await org("exp");
    const { user } = await platformService.provisionMember(o.id, { email: `${TAG}-exp@example.com` }, operator.id);
    made.users.push(user.id);

    const { issueToken } = require("../src/auth/verification");
    const { token } = await issueToken(user.id, `${TAG}-exp@example.com`, "PASSWORD_RESET");
    // Age it past its life rather than waiting an hour.
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await consumeToken(token, "PASSWORD_RESET", `${TAG}-exp@example.com`);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "EXPIRED");
  });

  test("issuing a second invitation retires the first", async () => {
    const o = await org("retire");
    const { user } = await platformService.provisionMember(o.id, { email: `${TAG}-retire@example.com` }, operator.id);
    made.users.push(user.id);

    const { issueToken } = require("../src/auth/verification");
    const { token: older } = await issueToken(user.id, `${TAG}-retire@example.com`, "PASSWORD_RESET");
    await issueToken(user.id, `${TAG}-retire@example.com`, "PASSWORD_RESET");

    const result = await consumeToken(older, "PASSWORD_RESET", `${TAG}-retire@example.com`);
    assert.equal(result.ok, false, "an old invitation link must stop working");
  });
});

describe("the provisioned account is scoped", () => {
  test("it belongs to exactly one organisation, and sees only that one", async () => {
    const a = await org("iso-a");
    const b = await org("iso-b");
    const { user: admin } = await platformService.provisionMember(a.id, { email: `${TAG}-iso@example.com` }, operator.id);
    made.users.push(admin.id);

    const cb = await prisma.user.create({
      data: { name: "B cust", email: `${TAG}-bcust@example.com`, password: "x", realm: "CUSTOMER", role: "CUSTOMER", organizationId: b.id },
    });
    made.users.push(cb.id);

    const { enterpriseAdminService } = require("../src/services/admin.enterprise.service");
    const { customers } = await enterpriseAdminService.customers(admin.organizationId, {});
    assert.ok(!customers.some((c) => c.id === cb.id), "must not see another tenant's customer");
    await assert.rejects(
      () => enterpriseAdminService.customer(admin.organizationId, cb.id),
      /does not exist/
    );
  });
});
