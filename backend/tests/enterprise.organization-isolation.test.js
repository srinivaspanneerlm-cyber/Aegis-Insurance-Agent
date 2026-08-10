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
const made = { orgs: [], users: [], profiles: [], policies: [], work: [], companies: [], recommendations: [] };

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
/**
 * One insurer both tenants sell, which is the ordinary case and the one the
 * per-tenant fixtures above cannot express. Insurers are shared reference data,
 * so a count hanging off one is the place a tenant boundary is easiest to lose.
 */
let sharedInsurer;

before(async () => {
  A = await tenant("alpha");
  B = await tenant("beta");

  sharedInsurer = await prisma.company.create({ data: { companyName: `${TAG} shared insurer` } });
  made.companies.push(sharedInsurer.id);
  for (const [slug, t] of [["alpha", A], ["beta", B]]) {
    const p = await prisma.policy.create({
      data: {
        policyName: `${slug} shared product`, premium: 200, coverage: "test",
        companyId: sharedInsurer.id, organizationId: t.org.id,
      },
    });
    made.policies.push(p.id);
  }

  // Only beta has ever produced a recommendation. Alpha's console must show no
  // trace of it — not the count, and not the timestamp.
  const rec = await prisma.recommendationHistory.create({
    data: { userId: B.customer.id, domain: "health", planName: `${TAG} beta plan` },
  });
  made.recommendations = [rec.id];
});

after(async () => {
  await prisma.recommendationHistory.deleteMany({ where: { id: { in: made.recommendations } } });
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

describe("filtering and row caps", () => {
  // The console filters on the server. These cover the two ways that used to
  // go wrong: a filter that matches nothing returning a broken shape, and a
  // cap the caller could not raise.
  test("an organisation with no staff still gets a capacity and its departments", async () => {
    const empty = await prisma.organization.create({
      data: { slug: `${TAG}-empty`, name: "Empty Ltd" },
    });
    made.orgs.push(empty.id);

    const result = await enterpriseAdminService.employees(empty.id, {});
    assert.deepEqual(result.employees, []);
    // The console reads capacity.activeStaff behind a truthy-payload guard, so
    // omitting it here blanked the page for every tenant that had not hired yet.
    assert.ok(result.capacity, "an empty workforce is still a workforce shape");
    assert.equal(result.capacity.activeStaff, 0);
    assert.equal(result.capacity.utilisation, null, "no staff means no utilisation, not 0%");
  });

  test("a department filter that matches nothing keeps the controls that undo it", async () => {
    const result = await enterpriseAdminService.employees(A.org.id, { department: "no-such-team" });
    assert.deepEqual(result.employees, []);
    assert.ok(
      result.departments.some((d) => d.department === "claims"),
      "the department chips must survive an empty result, or there is no way back"
    );
    assert.ok(result.capacity);
  });

  test("the department counts are the tenant's own, not the filter's", async () => {
    const filtered = await enterpriseAdminService.employees(A.org.id, { department: "claims" });
    const all = await enterpriseAdminService.employees(A.org.id, {});
    assert.deepEqual(
      filtered.departments,
      all.departments,
      "counts are org-wide so the chips read the same either way"
    );
  });

  test("take is honoured and clamped rather than refused", async () => {
    const one = await enterpriseAdminService.customers(A.org.id, { take: 1 });
    assert.equal(one.customers.length, 1);
    assert.equal(one.total, 1, "the total counts the matches, not the page");

    // Above the maximum the server answers with its maximum. A console that
    // asks for more must get rows, not an error.
    const huge = await enterpriseAdminService.customers(A.org.id, { take: 10_000 });
    assert.ok(huge.customers.length <= 100);
    const nonsense = await enterpriseAdminService.customers(A.org.id, { take: "abc" });
    assert.ok(nonsense.customers.length >= 0, "a junk take falls back rather than throwing");
  });
});

describe("reports", () => {
  // Reports were the one console surface with no isolation test. They are also
  // the surface that leaves the building as a file, so a leak here walks out of
  // the tenant on somebody's laptop rather than staying on a screen.
  test("the operations summary counts only the caller's tenant", async () => {
    const report = await enterpriseAdminService.report(A.org.id, "operations", A.staff.id);
    const rows = Object.fromEntries(report.rows.map((r) => [r.metric, r.value]));
    assert.equal(rows.Customers, 1, "alpha holds exactly one customer");
    // Two: alpha's own-insurer product and its product from the shared insurer.
    // Beta holds the same two, so a report that had lost the tenant would say 4.
    assert.equal(rows["Active policies"], 2);
    assert.equal(rows["Open cases"], 1);
  });

  test("the branch comparison never names another tenant's branch", async () => {
    const report = await enterpriseAdminService.report(A.org.id, "branches", A.staff.id);
    const branches = report.rows.map((r) => r.branch);
    assert.ok(branches.includes("alpha branch"));
    assert.ok(!branches.includes("beta branch"), "beta's branch must not appear in alpha's report");
  });

  test("compliance findings are computed per tenant", async () => {
    const a = await enterpriseAdminService.report(A.org.id, "compliance", A.staff.id);
    const b = await enterpriseAdminService.report(B.org.id, "compliance", B.staff.id);
    // Same checks run for both, but the affected counts are each tenant's own.
    assert.deepEqual(
      a.rows.map((r) => r.check),
      b.rows.map((r) => r.check),
      "both tenants are held to the same checks"
    );
    for (const row of a.rows) {
      assert.equal(typeof row.affected, "number", "every finding carries a count");
    }
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

/**
 * Counts that hang off shared reference data.
 *
 * A relation count inherits no scope from the row it is selected on. Both
 * tenants sell the same insurer, so an unfiltered count there reported the
 * platform's products under that insurer's name: subtract your own catalogue
 * and you have your competitor's, refreshed on every page load.
 */
describe("shared insurers", () => {
  test("an insurer's product count is the caller's own, not the platform's", async () => {
    const a = await enterpriseAdminService.products(A.org.id, {});
    const shared = a.companies.find((c) => c.id === sharedInsurer.id);
    assert.ok(shared, "the shared insurer is on alpha's catalogue");
    assert.equal(
      shared._count.policies,
      1,
      "alpha sells one product from this insurer; beta's must not be counted"
    );
  });

  test("the mirror image holds for the other tenant", async () => {
    const b = await enterpriseAdminService.products(B.org.id, {});
    const shared = b.companies.find((c) => c.id === sharedInsurer.id);
    assert.equal(shared._count.policies, 1);
  });

  test("both tenants really do sell that insurer, so the count above is not a filter artefact", async () => {
    const total = await prisma.policy.count({ where: { companyId: sharedInsurer.id } });
    assert.equal(total, 2, "the leak has something to leak — two tenants, one insurer");
  });
});

/**
 * AI activity.
 *
 * The recommendation figures were read without a tenant at all, so one
 * organisation's console reported when another last advised somebody.
 */
describe("AI systems", () => {
  const engine = (systems) => systems.find((s) => s.id === "recommendation-engine");

  test("a tenant with no recommendations reports none", async () => {
    const a = engine(await enterpriseAdminService.aiSystems(A.org.id));
    assert.equal(a.activity, 0, "alpha has produced no recommendations");
    assert.equal(a.lastActivityAt, null, "and must not learn when beta last produced one");
  });

  test("the tenant that has them reports its own", async () => {
    const b = engine(await enterpriseAdminService.aiSystems(B.org.id));
    assert.equal(b.activity, 1);
    assert.ok(b.lastActivityAt, "beta sees its own recommendation");
  });
});

/**
 * The response cache.
 *
 * A cache key that drops its organisation does not serve a stale page — it
 * serves another organisation's page to whoever asks next. These calls run
 * back to back, well inside the TTL, which is exactly the window such a bug
 * would live in.
 */
describe("cached panels stay tenant-scoped", () => {
  test("two tenants asking in turn each get their own dashboard", async () => {
    const a1 = await enterpriseAdminService.dashboard(A.org.id);
    const b1 = await enterpriseAdminService.dashboard(B.org.id);
    const a2 = await enterpriseAdminService.dashboard(A.org.id);

    assert.deepEqual(a1.branches.map((x) => x.branch), ["alpha branch"]);
    assert.deepEqual(b1.branches.map((x) => x.branch), ["beta branch"]);
    assert.deepEqual(
      a2.branches.map((x) => x.branch),
      ["alpha branch"],
      "alpha's second read must not have been overwritten by beta's"
    );
  });

  test("the same holds for analytics and compliance", async () => {
    const [aAnalytics, bAnalytics] = [
      await enterpriseAdminService.analytics(A.org.id),
      await enterpriseAdminService.analytics(B.org.id),
    ];
    assert.deepEqual(aAnalytics.branches.map((x) => x.branch), ["alpha branch"]);
    assert.deepEqual(bAnalytics.branches.map((x) => x.branch), ["beta branch"]);

    const aCompliance = await enterpriseAdminService.compliance(A.org.id);
    const bCompliance = await enterpriseAdminService.compliance(B.org.id);
    assert.equal(aCompliance.summary.checksRun, bCompliance.summary.checksRun);
    assert.ok(Array.isArray(aCompliance.findings));
  });
});
