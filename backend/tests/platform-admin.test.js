/**
 * Platform administration, driven through the real app.
 *
 * This is the highest authority on the platform, so the tests are mostly about
 * its limits: who cannot reach it, what it still cannot do, and whether the
 * things it *can* do leave a trace and take effect properly.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3104,http://localhost:3105,http://localhost:3000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-platform-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after, before } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { seedSettings, DEFAULT_SETTINGS } = require("../src/platform/defaultSettings");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3104";
const PASSWORD = "correct-horse-battery";

before(async () => {
  await seedSettings(prisma);
});

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
  const email = `plat-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Subject ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201);

  if (realm !== "CUSTOMER") {
    await prisma.user.update({
      where: { id: res.body.data.user.id },
      data: { realm, role, emailVerifiedAt: new Date() },
    });
  }
  return { userId: res.body.data.user.id, email, cookie: cookieHeader(res) };
}

const operator = () => account("operator", "PLATFORM", "PLATFORM_ADMIN");

/** An operator whose session also carries a fresh re-authentication. */
async function operatorWithStepUp(tag = "op") {
  const op = await account(tag, "PLATFORM", "PLATFORM_ADMIN");
  const res = await request(app)
    .post("/api/v1/auth/step-up")
    .set("Cookie", op.cookie)
    .set("Origin", ORIGIN)
    .send({ password: PASSWORD });
  assert.equal(res.status, 200, "step-up should succeed");
  return { ...op, cookie: `${op.cookie}; ${cookieHeader(res)}` };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/platform${p}`).set("Cookie", cookie),
  post: (p, body) =>
    request(app).post(`/api/v1/platform${p}`).set("Cookie", cookie).set("Origin", ORIGIN).send(body),
  patch: (p, body) =>
    request(app).patch(`/api/v1/platform${p}`).set("Cookie", cookie).set("Origin", ORIGIN).send(body),
});

const READ_ENDPOINTS = [
  "/overview",
  "/organizations",
  "/licences",
  "/identities",
  "/roles",
  "/sessions",
  "/settings",
  "/security",
  "/ai-governance",
  "/backup",
  "/integrations",
];

// ── The wall ─────────────────────────────────────────────────────────────────

describe("Platform console — who may reach it", () => {
  test("a customer is refused everywhere", async () => {
    const customer = await account("customer");
    for (const p of READ_ENDPOINTS) {
      assert.equal((await api(customer.cookie).get(p)).status, 403, `GET ${p}`);
    }
  });

  test("an employee is refused everywhere", async () => {
    const employee = await account("employee", "EMPLOYEE", "EMPLOYEE");
    for (const p of READ_ENDPOINTS) {
      assert.equal((await api(employee.cookie).get(p)).status, 403, `GET ${p}`);
    }
  });

  test("an enterprise administrator is refused everywhere", async () => {
    // The one that matters most. An organisation's own administrator is
    // powerful *within* their organisation; this console is above every
    // organisation, and their authority must stop at the boundary.
    const admin = await account("entadmin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    for (const p of READ_ENDPOINTS) {
      assert.equal((await api(admin.cookie).get(p)).status, 403, `GET ${p}`);
    }
  });

  test("an unauthenticated request is refused", async () => {
    assert.equal((await request(app).get("/api/v1/platform/overview")).status, 401);
  });

  test("a platform operator gets in", async () => {
    const op = await operator();
    for (const p of READ_ENDPOINTS) {
      assert.equal((await api(op.cookie).get(p)).status, 200, `GET ${p}`);
    }
  });
});

// ── Writes need a fresh re-authentication ────────────────────────────────────

describe("Platform console — structural changes need re-authentication", () => {
  test("creating an organisation is refused without a fresh confirmation", async () => {
    // A session cookie alone cannot tell the operator from whoever sat down at
    // their unlocked laptop, and everything mutable here is structural.
    const op = await operator();
    const res = await api(op.cookie).post("/organizations", { name: "Acme Insurance" });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "REAUTH_REQUIRED");
  });

  test("with a fresh confirmation it succeeds", async () => {
    const op = await operatorWithStepUp("create");
    const res = await api(op.cookie).post("/organizations", { name: "Acme Insurance Ltd" });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.organization.slug, "acme-insurance-ltd");
  });

  test("changing a setting is refused without one", async () => {
    const op = await operator();
    const res = await api(op.cookie).patch("/settings/security.lockout_threshold", { value: "5" });
    assert.equal(res.status, 401);
  });
});

// ── Organizations ────────────────────────────────────────────────────────────

describe("Organizations", () => {
  test("a new organisation gets a licence in the same operation", async () => {
    // An organisation without a licence is a record nothing can decide about.
    const op = await operatorWithStepUp("lic");
    const res = await api(op.cookie).post("/organizations", { name: `Licensed Co ${Date.now()}` });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.organization.license, "a licence exists immediately");
    assert.equal(res.body.data.organization.license.plan, "TRIAL");
  });

  test("a trial always has an end date", async () => {
    // A trial without one is a bug, not a gift.
    const op = await operatorWithStepUp("trial");
    const res = await api(op.cookie).post("/organizations", { name: `Trial Co ${Date.now()}` });
    assert.ok(res.body.data.organization.license.expiresAt, "trials expire");
  });

  test("two organisations cannot share a name", async () => {
    const op = await operatorWithStepUp("dupe");
    const name = `Duplicate Co ${Date.now()}`;
    assert.equal((await api(op.cookie).post("/organizations", { name })).status, 201);
    assert.equal((await api(op.cookie).post("/organizations", { name })).status, 409);
  });

  test("suspending an organisation signs its staff out", async () => {
    // A suspension that leaves people signed in until their token expires is
    // not a suspension — it is a note in a database.
    const op = await operatorWithStepUp("suspend");
    const created = await api(op.cookie).post("/organizations", { name: `Suspend Co ${Date.now()}` });
    const orgId = created.body.data.organization.id;

    const staff = await account("staff", "EMPLOYEE", "EMPLOYEE");
    await prisma.user.update({ where: { id: staff.userId }, data: { organizationId: orgId } });

    const res = await api(op.cookie).patch(`/organizations/${orgId}/status`, { status: "SUSPENDED" });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.endedSessions >= 1, "their session ended");

    const renewed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("Origin", ORIGIN);
    assert.equal(renewed.status, 401, "the credential is dead too");
  });

  test("an unknown status is refused", async () => {
    const op = await operatorWithStepUp("badstatus");
    const created = await api(op.cookie).post("/organizations", { name: `Status Co ${Date.now()}` });
    const res = await api(op.cookie).patch(
      `/organizations/${created.body.data.organization.id}/status`,
      { status: "DELETED_FOREVER" }
    );
    assert.equal(res.status, 400);
  });
});

// ── Licensing ────────────────────────────────────────────────────────────────

describe("Licensing", () => {
  test("seats cannot be cut below the accounts that exist", async () => {
    // Applying it silently would put somebody over their limit the moment it
    // saves, with no indication of who gets locked out.
    const op = await operatorWithStepUp("seats");
    const created = await api(op.cookie).post("/organizations", { name: `Seat Co ${Date.now()}` });
    const orgId = created.body.data.organization.id;

    for (let i = 0; i < 3; i += 1) {
      const staff = await account(`seat${i}`, "EMPLOYEE", "EMPLOYEE");
      await prisma.user.update({ where: { id: staff.userId }, data: { organizationId: orgId } });
    }

    const res = await api(op.cookie).patch(`/organizations/${orgId}/licence`, { seats: 1 });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "SEATS_IN_USE");
  });

  test("expiry state is derived, not stored", async () => {
    const op = await operatorWithStepUp("expiry");
    const created = await api(op.cookie).post("/organizations", { name: `Expiry Co ${Date.now()}` });
    await prisma.license.update({
      where: { organizationId: created.body.data.organization.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const licences = (await api(op.cookie).get("/licences")).body.data.licences;
    const row = licences.find((l) => l.organizationId === created.body.data.organization.id);
    assert.equal(row.expiryState, "EXPIRED");
  });
});

// ── Configuration ────────────────────────────────────────────────────────────

describe("Platform configuration", () => {
  test("a boolean setting rejects anything but true or false", async () => {
    // "false" as a string is truthy, which is how a feature flag ends up
    // meaning the opposite of what it says.
    const op = await operatorWithStepUp("bool");
    const res = await api(op.cookie).patch("/settings/ai.customer_assistant_enabled", {
      value: "no",
    });
    assert.equal(res.status, 400);
  });

  test("a number setting rejects text", async () => {
    const op = await operatorWithStepUp("num");
    const res = await api(op.cookie).patch("/settings/security.lockout_threshold", {
      value: "eight",
    });
    assert.equal(res.status, 400);
  });

  test("a valid change is applied and audited with the previous value", async () => {
    // "What did this used to be" is the first question after a configuration
    // change breaks something.
    const op = await operatorWithStepUp("apply");
    const res = await api(op.cookie).patch("/settings/security.lockout_threshold", { value: "6" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.setting.value, "6");

    await new Promise((resolve) => setTimeout(resolve, 200));
    const entry = await prisma.auditLog.findFirst({
      where: { actorId: op.userId, action: "platform.setting.updated" },
    });
    assert.ok(entry);
    assert.ok(entry.metadata.includes("from"), "the previous value is recorded");
  });

  test("secrets are declared environment-only rather than editable", async () => {
    const op = await operator();
    const res = await api(op.cookie).get("/settings");
    const keys = res.body.data.environmentOnly.map((e) => e.key);
    assert.ok(keys.includes("JWT_SECRET"));
    assert.ok(keys.includes("DATABASE_URL"));
  });

  test("an unknown setting cannot be created by writing to it", async () => {
    const op = await operatorWithStepUp("unknown");
    const res = await api(op.cookie).patch("/settings/made.up.key", { value: "x" });
    assert.equal(res.status, 404);
  });

  test("every declared default is seeded", async () => {
    const op = await operator();
    const res = await api(op.cookie).get("/settings");
    assert.equal(res.body.data.settings.length, DEFAULT_SETTINGS.length);
  });
});

// ── Infrastructure and governance ────────────────────────────────────────────

describe("Infrastructure telemetry", () => {
  test("components report a real probe, and name what backs them", async () => {
    const op = await operator();
    const { components } = (await api(op.cookie).get("/overview")).body.data;

    const database = components.find((c) => c.id === "database");
    assert.equal(database.status, "UP");
    assert.ok(typeof database.latencyMs === "number", "a real round trip was measured");
    assert.ok(["sqlite", "postgresql"].includes(database.implementation));
  });

  test("an in-process fallback is not reported as production-ready", async () => {
    // Without REDIS_URL the queue is in-memory, and saying UP would hide that
    // jobs are lost on restart.
    const op = await operator();
    const { components } = (await api(op.cookie).get("/overview")).body.data;
    const queue = components.find((c) => c.id === "queue");
    assert.equal(queue.status, "NOT_CONFIGURED");
  });

  test("no connection string reaches the client", async () => {
    const op = await operator();
    const body = JSON.stringify((await api(op.cookie).get("/overview")).body);
    assert.ok(!body.includes("file:"), "no database url");
    assert.ok(!/postgres:\/\/|redis:\/\//.test(body), "no credentials in any scheme");
  });

  test("metrics the platform does not keep are declared", async () => {
    const op = await operator();
    const { missingTelemetry } = (await api(op.cookie).get("/overview")).body.data;
    const ids = missingTelemetry.map((m) => m.id);
    assert.ok(ids.includes("request-rate"));
    assert.ok(ids.includes("ai-token-usage"));
    for (const item of missingTelemetry) assert.ok(item.needs, `${item.id} says what is needed`);
  });

  test("revenue is declared unavailable", async () => {
    const op = await operator();
    const { revenue } = (await api(op.cookie).get("/overview")).body.data;
    assert.equal(revenue.available, false);
  });
});

describe("AI governance", () => {
  test("governance fields that are not reported are declared, not invented", async () => {
    const op = await operator();
    const res = await api(op.cookie).get("/ai-governance");

    for (const system of res.body.data.systems) {
      assert.equal(system.governance.version, null);
      assert.equal(system.governance.tokenUsage, null);
    }
    const fields = res.body.data.notInstrumented.map((n) => n.field);
    assert.ok(fields.includes("version"));
    assert.ok(fields.includes("tokenUsage"));
  });

  test("the console states that model logic is not changed from here", async () => {
    const op = await operator();
    const res = await api(op.cookie).get("/ai-governance");
    assert.match(res.body.data.changeControl, /never from this console/i);
  });

  test("there is no route that changes an agent", async () => {
    const op = await operatorWithStepUp("aiwrite");
    for (const [method, p] of [
      ["post", "/ai-governance"],
      ["patch", "/ai-governance"],
      ["post", "/agents"],
    ]) {
      const res = await request(app)
        [method](`/api/v1/platform${p}`)
        .set("Cookie", op.cookie)
        .set("Origin", ORIGIN)
        .send({});
      assert.ok(res.status === 404 || res.status === 405, `${method} ${p} → ${res.status}`);
    }
  });
});

describe("Backup and recovery", () => {
  test("the console admits it cannot take or restore a backup", async () => {
    // A backup button that shells out to the database from a web request is how
    // a console becomes the most dangerous thing in an estate.
    const op = await operator();
    const res = await api(op.cookie).get("/backup");

    assert.equal(res.body.data.capability.available, false);
    assert.ok(res.body.data.capability.needs.length > 20);
    assert.ok(res.body.data.schema.migrationsApplied > 0, "but it does show real schema state");
  });
});

describe("Identity oversight", () => {
  test("no credential material is returned for any account", async () => {
    // An operator needs to know an account exists and works, not how to become it.
    const op = await operator();
    const body = JSON.stringify((await api(op.cookie).get("/identities")).body);
    for (const forbidden of ["password", "tokenHash", "mfaMethod", "$2b$"]) {
      assert.ok(!body.includes(forbidden), `"${forbidden}" must not appear`);
    }
  });

  test("the role model is served from the code the middleware enforces", async () => {
    const op = await operator();
    const res = await api(op.cookie).get("/roles");
    const roles = res.body.data.roles.map((r) => r.role);
    assert.ok(roles.includes("PLATFORM_ADMIN"));
    assert.ok(roles.includes("CUSTOMER"));
    assert.match(res.body.data.note, /defined in code/i);
  });
});
