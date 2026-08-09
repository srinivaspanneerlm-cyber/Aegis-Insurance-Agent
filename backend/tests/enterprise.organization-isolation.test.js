/**
 * Organisation isolation on the enterprise console.
 *
 * Before this, admin.enterprise.service queried globally: it never received the
 * caller, and no business table carried a tenant. An ENTERPRISE_ADMIN of one
 * organisation read every organisation's customers, employees, claims,
 * catalogue and audit trail.
 *
 * These tests exercise the service directly against a real database, with two
 * organisations holding deliberately different records. A leak here is a
 * cross-tenant data breach, so each assertion checks both that the caller sees
 * their own rows AND that the other tenant's are absent — an empty result would
 * satisfy the first alone.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, before, after } = require("node:test");

const { PrismaClient } = require("@prisma/client");
const { enterpriseAdminService } = require("../src/services/admin.enterprise.service");

const prisma = new PrismaClient();
const TAG = `iso-${Date.now()}`;
const made = { orgs: [], users: [], profiles: [], policies: [], work: [], companies: [] };

async function tenant(slug) {
  const org = await prisma.organization.create({ data: { slug: `${TAG}-${slug}`, name: `${slug} Ltd` } });
  made.orgs.push(org.id);

  const customer = await prisma.user.create({
    data: {
      name: `${slug} customer`, email: `${TAG}-${slug}-cust@example.com`,
      password: "x", realm: "CUSTOMER", role: "CUSTOMER", organizationId: org.id,
    },
  });
  const staff = await prisma.user.create({
    data: {
      name: `${slug} staff`, email: `${TAG}-${slug}-staff@example.com`,
      password: "x", realm: "EMPLOYEE", role: "EMPLOYEE", organizationId: org.id,
    },
  });
  made.users.push(customer.id, staff.id);

  const profile = await prisma.employeeProfile.create({
    data: {
      userId: staff.id, employeeCode: `${TAG}-${slug}`, department: "claims",
      designation: "Advisor", branch: `${slug} branch`, organizationId: org.id,
    },
  });
  made.profiles.push(profile.id);

  const company = await prisma.company.create({ data: { companyName: `${TAG}-${slug} insurer` } });
  made.companies.push(company.id);
  const policy = await prisma.policy.create({
    data: {
      policyName: `${slug} product`, premium: 100, coverage: "test",
      companyId: company.id, organizationId: org.id,
    },
  });
  made.policies.push(policy.id);

  const claim = await prisma.workItem.create({
    data: {
      kind: "CLAIM", reference: `${TAG}-${slug}-CLM`, title: `${slug} claim`,
      assigneeId: profile.id, customerId: customer.id, organizationId: org.id,
    },
  });
  made.work.push(claim.id);

  await prisma.auditLog.create({ data: { actorId: staff.id, action: `${TAG}.${slug}.action` } });

  return { org, customer, staff, profile, policy, claim };
}

let A, B;

before(async () => { A = await tenant("alpha"); B = await tenant("beta"); });

after(async () => {
  await prisma.auditLog.deleteMany({ where: { action: { startsWith: TAG } } });
  await prisma.workItem.deleteMany({ where: { id: { in: made.work } } });
  await prisma.policy.deleteMany({ where: { id: { in: made.policies } } });
  await prisma.company.deleteMany({ where: { id: { in: made.companies } } });
  await prisma.employeeProfile.deleteMany({ where: { id: { in: made.profiles } } });
  await prisma.user.deleteMany({ where: { id: { in: made.users } } });
  await prisma.organization.deleteMany({ where: { id: { in: made.orgs } } });
  await prisma.$disconnect();
});

describe("customers", () => {
  test("an admin sees their own tenant's customers and not the other's", async () => {
    const { customers } = await enterpriseAdminService.customers(A.org.id, {});
    const ids = customers.map((c) => c.id);
    assert.ok(ids.includes(A.customer.id), "own customer must be visible");
    assert.ok(!ids.includes(B.customer.id), "other tenant's customer must not be");
  });

  test("the other admin sees the mirror image", async () => {
    const { customers } = await enterpriseAdminService.customers(B.org.id, {});
    const ids = customers.map((c) => c.id);
    assert.ok(ids.includes(B.customer.id));
    assert.ok(!ids.includes(A.customer.id));
  });

  test("search cannot reach across the boundary", async () => {
    const { customers } = await enterpriseAdminService.customers(A.org.id, { search: "beta customer" });
    assert.equal(customers.length, 0);
  });
});

describe("one customer by id", () => {
  test("their own resolves", async () => {
    const result = await enterpriseAdminService.customer(A.org.id, A.customer.id);
    assert.equal(result.customer.id, A.customer.id);
  });

  test("another tenant's is not found, not merely filtered", async () => {
    await assert.rejects(
      () => enterpriseAdminService.customer(A.org.id, B.customer.id),
      /does not exist/,
      "a known id from another tenant must read as absent"
    );
  });
});

describe("employees", () => {
  test("scoped to the caller's organisation", async () => {
    const { employees } = await enterpriseAdminService.employees(A.org.id, {});
    const codes = employees.map((e) => e.employeeCode);
    assert.ok(codes.includes(`${TAG}-alpha`));
    assert.ok(!codes.includes(`${TAG}-beta`));
  });
});

describe("products", () => {
  test("the catalogue is scoped", async () => {
    const { policies } = await enterpriseAdminService.products(A.org.id, {});
    const names = policies.map((p) => p.policyName);
    assert.ok(names.includes("alpha product"));
    assert.ok(!names.includes("beta product"));
  });
});

describe("claims", () => {
  test("only the caller's claims are listed", async () => {
    const { recent } = await enterpriseAdminService.claims(A.org.id);
    const refs = recent.map((c) => c.reference);
    assert.ok(refs.includes(`${TAG}-alpha-CLM`));
    assert.ok(!refs.includes(`${TAG}-beta-CLM`));
  });
});

describe("audit trail", () => {
  test("entries are scoped by the actor's organisation", async () => {
    const { entries } = await enterpriseAdminService.auditLog(A.org.id, { take: 100 });
    const actions = entries.map((e) => e.action);
    assert.ok(actions.includes(`${TAG}.alpha.action`));
    assert.ok(!actions.includes(`${TAG}.beta.action`));
  });
});

describe("dashboard counts", () => {
  test("each tenant counts only itself", async () => {
    const a = await enterpriseAdminService.dashboard(A.org.id);
    assert.equal(a.overview.customers.value.total, 1, "alpha has exactly one customer");
    assert.equal(a.overview.employees.value.total, 1);
    assert.equal(a.overview.claims.value.total, 1);
    // The branch table is the clearest cross-tenant tell: beta's branch must
    // not appear in alpha's comparison.
    assert.deepEqual(a.branches.map((b) => b.branch), ["alpha branch"]);
  });
});
