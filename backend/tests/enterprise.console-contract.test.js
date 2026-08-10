/**
 * The contract between the console API and the console that reads it.
 *
 * Every screen in `apps/enterprise-portal` declares the shape it expects, in
 * TypeScript, against a server that has no idea those declarations exist. The
 * compiler checks the portal against its own beliefs — never against what the
 * API actually sends. Nothing in either tree fails when the two drift.
 *
 * That drift has been the defect of this entire phase, and it has run in both
 * directions: fields the backend sent and the screen silently dropped, and
 * fields the screen read that arrived undefined. The second is worse, because
 * `undefined` renders as a blank rather than an error — an administrator reads
 * a missing figure as a zero and makes a decision on it.
 *
 * So this file asserts, over real HTTP through the real middleware stack, that
 * every key the portal declares is actually present. The key lists below are
 * transcribed from `apps/enterprise-portal/src/lib/api.ts` and
 * `src/lib/console.ts`; when a payload changes, both must change together, and
 * that is the point of the file rather than an inconvenience of it.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3103,http://localhost:3105,http://localhost:3000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-contract-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, before, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3103";
const PASSWORD = "correct-horse-battery";

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

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag, realm, role, organizationId = null) {
  seq += 1;
  const email = `contract-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Subject ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201);

  if (realm !== "CUSTOMER" || organizationId) {
    await prisma.user.update({
      where: { id: res.body.data.user.id },
      data: {
        ...(realm ? { realm, role } : {}),
        emailVerifiedAt: new Date(),
        ...(organizationId ? { organizationId } : {}),
      },
    });
  }
  return { userId: res.body.data.user.id, email, cookie: cookieHeader(res) };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/enterprise${p}`).set("Cookie", cookie),
});

let boss;
let operator;
let org;
let customerId;

/**
 * A tenant with something in every table the console reads.
 *
 * An empty tenant would pass a key-presence check trivially — most of these
 * payloads carry their keys whether or not there are rows behind them — but it
 * would not exercise the row-shaped parts of each response, which is where a
 * missing field actually hides.
 */
before(async () => {
  org = await prisma.organization.create({
    data: { slug: `contract-${Date.now()}`, name: "Contract Ltd", status: "ACTIVE" },
  });
  await prisma.license.create({
    data: { organizationId: org.id, plan: "TRIAL", seats: 5, startsAt: new Date() },
  });

  boss = await account("admin", "ENTERPRISE", "ENTERPRISE_ADMIN", org.id);
  operator = await account("operator", "ENTERPRISE", "PLATFORM_ADMIN", org.id);
  const customer = await account("cust", "CUSTOMER", "CUSTOMER", org.id);
  customerId = customer.userId;

  const staff = await account("staff", "EMPLOYEE", "EMPLOYEE", org.id);
  const profile = await prisma.employeeProfile.create({
    data: {
      userId: staff.userId,
      organizationId: org.id,
      employeeCode: `CON-${seq}`,
      department: "CLAIMS",
      designation: "Officer",
      branch: "Chennai",
      status: "ACTIVE",
      workloadLimit: 10,
    },
  });

  const company = await prisma.company.create({ data: { companyName: "Contract Insurer" } });
  await prisma.policy.create({
    data: {
      policyName: "Contract Cover",
      premium: 500,
      coverage: "test",
      companyId: company.id,
      organizationId: org.id,
    },
  });

  // One of each kind the console reports on separately.
  for (const kind of ["CLAIM", "RENEWAL", "KYC", "COMPLAINT", "APPOINTMENT"]) {
    await prisma.workItem.create({
      data: {
        organizationId: org.id,
        reference: `CON-${kind}`,
        kind,
        title: `Contract ${kind}`,
        status: "RESOLVED",
        priority: "MEDIUM",
        openedAt: new Date(Date.now() - 7_200_000),
        resolvedAt: new Date(),
        assigneeId: profile.id,
        customerId,
      },
    });
  }

  await prisma.uploadedDocument.create({
    data: {
      organizationId: org.id,
      ownerId: customerId,
      filename: "contract.pdf",
      filepath: "/tmp/contract.pdf",
      status: "PENDING",
    },
  });

  const insuranceProfile = await prisma.insuranceProfile.create({
    data: { userId: customerId, organizationId: org.id, completeness: 60, city: "Madurai" },
  });
  await prisma.heldPolicy.create({
    data: {
      organizationId: org.id,
      profileId: insuranceProfile.id,
      domain: "health",
      insurer: "Contract Insurer",
      productName: "Contract Cover",
      status: "ACTIVE",
      external: false,
      renewalDate: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  await prisma.intelligenceRun.create({
    data: {
      userId: customerId,
      organizationId: org.id,
      profileId: insuranceProfile.id,
      kind: "recommendation",
      engineVersion: "test",
      profileHash: "contract-fixture-hash",
      payload: "{}",
    },
  });
});

/**
 * Every top-level key each screen declares, transcribed from the portal.
 *
 * Endpoint → the keys `apps/enterprise-portal/src/lib/api.ts` says will be
 * there. A key missing here is a blank on a screen; a key missing there is a
 * figure the backend computed and nobody ever saw.
 */
const CONTRACT = {
  "/dashboard": ["overview", "trend", "branches", "compliance", "aiSystems"],
  "/analytics": ["overview", "trend", "branches"],
  "/organization": ["organization", "seats", "customers", "editable"],
  "/customers": ["total", "customers"],
  "/employees": ["employees", "departments", "capacity"],
  "/products": ["companies", "policies", "versionHistory"],
  "/claims": ["byStatus", "byPriority", "averageProcessingHours", "recent", "fraudIndicators"],
  "/policies": ["total", "byStatus", "sold", "held", "renewingSoon", "policies", "bookValue"],
  "/renewals": ["raised", "byStatus", "overdue", "next30", "next90", "upcoming", "renewalRate"],
  "/documents": [
    "byStatus",
    "unowned",
    "kycByStatus",
    "kycOverdue",
    "recent",
    "automatedVerification",
  ],
  "/intelligence": [
    "customers",
    "profiles",
    "withoutProfile",
    "runs",
    "withPolicies",
    "averageCompleteness",
    "byKind",
    "cohorts",
    "recent",
    "adviceOutcome",
  ],
  "/support": ["complaints", "appointments", "overdue", "recent", "satisfaction"],
  "/notifications": [
    "windowDays",
    "byCategory",
    "byStatus",
    "unread",
    "announcements",
    "announcementScope",
  ],
  "/roles": ["roles", "allPermissions", "assignable"],
  "/workflows": ["catalogue", "activity"],
  "/compliance": ["summary", "findings"],
  "/audit": ["total", "entries", "actions", "actors"],
  "/security-events": [
    "recent",
    "byOutcome",
    "clusters",
    "failuresLastDay",
    "sessions",
    "unattributedFailures",
  ],
};

describe("every payload carries what the console declares", () => {
  for (const [endpoint, keys] of Object.entries(CONTRACT)) {
    test(`GET ${endpoint}`, async () => {
      const res = await api(boss.cookie).get(endpoint);
      assert.equal(res.status, 200, `${endpoint} must answer 200`);
      const { data } = res.body;
      assert.ok(data, `${endpoint} must return a data envelope`);
      for (const key of keys) {
        assert.notEqual(
          data[key],
          undefined,
          `${endpoint} must send '${key}' — the console reads it`
        );
      }
    });
  }

  test("GET /ai-systems", async () => {
    // Platform capability, so the operator asks. Its absence for a tenant admin
    // is tested elsewhere; here the question is only what the payload carries.
    const res = await api(operator.cookie).get("/ai-systems");
    assert.equal(res.status, 200);
    const [system] = res.body.data.systems;
    for (const key of [
      "id",
      "name",
      "purpose",
      "audience",
      "health",
      "activity",
      "successRate",
      "errorRate",
      "workload",
      "lastActivityAt",
      "notes",
      "configurable",
    ]) {
      assert.notEqual(system[key], undefined, `an AI system must carry '${key}'`);
    }
  });

  test("GET /customers/:id", async () => {
    const res = await api(boss.cookie).get(`/customers/${customerId}`);
    assert.equal(res.status, 200);
    for (const key of ["customer", "work", "documents", "logins"]) {
      assert.notEqual(res.body.data[key], undefined, `a customer record must carry '${key}'`);
    }
  });

  test("GET /reports/:kind", async () => {
    for (const kind of ["operations", "compliance", "branches"]) {
      const res = await api(boss.cookie).get(`/reports/${kind}`);
      assert.equal(res.status, 200, `${kind} must generate`);
      for (const key of ["kind", "title", "rows", "generatedAt"]) {
        assert.notEqual(res.body.data[key], undefined, `${kind} must carry '${key}'`);
      }
      assert.ok(Array.isArray(res.body.data.rows), `${kind} rows must be an array`);
    }
  });
});

/**
 * The overview is nested two levels deep and drives the whole dashboard, so its
 * inner shape is worth asserting rather than trusting the outer key.
 */
describe("the overview's own shape", () => {
  test("every metric is present and says whether it is measured", async () => {
    const { overview } = (await api(boss.cookie).get("/dashboard")).body.data;
    const metrics = [
      "customers",
      "employees",
      "policies",
      "claims",
      "renewals",
      "kyc",
      "complaints",
      "documents",
      "system",
      "revenue",
      "customerSatisfaction",
      "fraudSignals",
      "documentVerification",
    ];
    for (const key of metrics) {
      assert.notEqual(overview[key], undefined, `overview must carry '${key}'`);
      assert.equal(
        typeof overview[key].available,
        "boolean",
        `'${key}' must declare whether it is measured`
      );
      if (overview[key].available === false) {
        assert.ok(overview[key].reason, `'${key}' must say why it is absent`);
        assert.ok(overview[key].needs, `'${key}' must say what would be needed`);
      }
    }
    assert.ok(overview.generatedAt, "the overview must say when it was generated");
  });

  test("the resolution average states what it is an average of", async () => {
    // Task 11 capped the sample behind this figure. A mean whose sample can be
    // capped and does not say so is read as the whole window.
    const { overview } = (await api(boss.cookie).get("/dashboard")).body.data;
    assert.equal(
      typeof overview.claims.value.averageResolutionBasis,
      "number",
      "the console renders this beside the average"
    );
  });
});

/**
 * The fixes this phase made, checked through the route rather than the service.
 *
 * Each of these was proven at the service layer when it was made. Passing there
 * and failing here would mean the middleware stack — validation, permissions,
 * the response envelope — undoes something the service got right.
 */
describe("phase fixes hold over HTTP", () => {
  test("an insurer's product count is the caller's own", async () => {
    const { companies } = (await api(boss.cookie).get("/products")).body.data;
    const insurer = companies.find((c) => c.companyName === "Contract Insurer");
    assert.ok(insurer, "the seeded insurer is listed");
    assert.equal(insurer._count.policies, 1, "one product, this tenant's own");
  });

  test("the security page states what it cannot see", async () => {
    const { unattributedFailures } = (await api(boss.cookie).get("/security-events")).body.data;
    assert.equal(unattributedFailures.available, false);
    assert.ok(unattributedFailures.reason, "it must say what is missing");
    assert.ok(unattributedFailures.needs, "and what would fix it");
  });

  test("cached panels stay tenant-scoped through the route", async () => {
    // The cache is keyed on the organisation resolved from the session. Two
    // sessions, two tenants, back to back and well inside the TTL.
    const other = await prisma.organization.create({
      data: { slug: `contract-other-${Date.now()}`, name: "Other Contract Ltd", status: "ACTIVE" },
    });
    const otherBoss = await account("other-admin", "ENTERPRISE", "ENTERPRISE_ADMIN", other.id);

    const mine = (await api(boss.cookie).get("/dashboard")).body.data;
    const theirs = (await api(otherBoss.cookie).get("/dashboard")).body.data;
    const mineAgain = (await api(boss.cookie).get("/dashboard")).body.data;

    assert.equal(mine.overview.employees.value.total, 1, "my tenant has one employee");
    assert.equal(theirs.overview.employees.value.total, 0, "theirs has none");
    assert.equal(
      mineAgain.overview.employees.value.total,
      1,
      "my cached copy must not have been replaced by theirs"
    );
  });

  test("take is clamped rather than refused on every list route", async () => {
    for (const p of ["/customers", "/employees", "/policies", "/audit", "/security-events"]) {
      const ok = await api(boss.cookie).get(`${p}?take=99999`);
      assert.equal(ok.status, 200, `${p} must answer, clamped`);
      const bad = await api(boss.cookie).get(`${p}?take=abc`);
      assert.equal(bad.status, 400, `${p} must name a bad take rather than ignore it`);
    }
  });

  test("a filtered list still says how much it is not showing", async () => {
    // Task 9: a capped list that reports no total cannot be told from a
    // complete one.
    const { total, customers } = (await api(boss.cookie).get("/customers?take=1")).body.data;
    assert.equal(typeof total, "number");
    assert.ok(customers.length <= 1);
  });
});
