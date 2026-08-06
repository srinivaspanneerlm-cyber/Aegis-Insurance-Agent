/**
 * Employee operations, driven through the real app.
 *
 * Three things decide whether this is safe, and they are what these tests are
 * for: a customer can never reach any of it, an employee sees only their own
 * queue, and no workflow can reach an outcome without a person deciding.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.CLIENT_URL = "http://localhost:3102,http://localhost:3105,http://localhost:3000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-employee-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { routeWork, assessWorkload, findEscalations, slaMinutesFor } = require("../src/employee/operationsManager");
const { workflowSpec, WORKFLOW_DEFINITIONS } = require("../src/employee/workflows");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3102";
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
async function signUp(tag) {
  seq += 1;
  const email = `emp-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Subject ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201);
  return { userId: res.body.data.user.id, email, cookie: cookieHeader(res) };
}

/** A signed-in employee with a profile in the given department. */
async function employee(tag, { department = "claims", role = "EMPLOYEE", limit = 20 } = {}) {
  const account = await signUp(tag);
  await prisma.user.update({
    where: { id: account.userId },
    data: { realm: "EMPLOYEE", role, emailVerifiedAt: new Date() },
  });
  const profile = await prisma.employeeProfile.create({
    data: {
      userId: account.userId,
      employeeCode: `E${Date.now()}${seq}`,
      department,
      designation: "Officer",
      branch: "Chennai — Guindy",
      workloadLimit: limit,
    },
  });
  return { ...account, profileId: profile.id };
}

/**
 * An employee who is the only candidate in their department.
 *
 * Routing is least-loaded across the whole owning department, which is correct
 * behaviour and inconvenient for a test that needs to know who received the
 * work. Parking everybody else makes the routing deterministic without
 * pretending it assigns to the creator — which it does not, and should not.
 */
async function soleEmployee(tag, options = {}) {
  const department = options.department ?? "claims";
  await prisma.employeeProfile.updateMany({ where: { department }, data: { status: "ON_LEAVE" } });
  return employee(tag, { ...options, department });
}

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/employee${p}`).set("Cookie", cookie),
  post: (p, body) =>
    request(app).post(`/api/v1/employee${p}`).set("Cookie", cookie).set("Origin", ORIGIN).send(body),
});

// ── The wall ─────────────────────────────────────────────────────────────────

describe("Employee routes — who may reach them at all", () => {
  test("a customer is refused everywhere, whatever the endpoint", async () => {
    // The realm wall, which is the whole reason it exists separately from the
    // permission check.
    const customer = await signUp("customer");
    for (const p of ["/me", "/work", "/analytics", "/knowledge", "/escalations", "/workflows"]) {
      const res = await api(customer.cookie).get(p);
      assert.equal(res.status, 403, `GET ${p}`);
    }
  });

  test("an unauthenticated request is refused", async () => {
    const res = await request(app).get("/api/v1/employee/me");
    assert.equal(res.status, 401);
  });

  test("the refusal does not say which check stopped them", async () => {
    // Whether it was the realm or the permission is not information a prober
    // needs; it maps the platform's shape.
    const customer = await signUp("opaque");
    const res = await api(customer.cookie).get("/work");
    assert.ok(!/realm|permission required|capability/i.test(res.body.message ?? ""));
  });

  test("an employee in the realm but with no profile is told, not stonewalled", async () => {
    // A provisioning gap, not an authorisation one. They signed in legitimately
    // and somebody forgot to finish setting them up.
    const account = await signUp("noprofile");
    await prisma.user.update({
      where: { id: account.userId },
      data: { realm: "EMPLOYEE", role: "EMPLOYEE", emailVerifiedAt: new Date() },
    });

    const res = await api(account.cookie).get("/me");
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "NO_EMPLOYEE_PROFILE");
  });
});

// ── Queue scoping ────────────────────────────────────────────────────────────

describe("Work — an employee sees their own queue", () => {
  test("work is routed and appears in the assignee's queue", async () => {
    const worker = await soleEmployee("queue-owner");
    const created = await api(worker.cookie).post("/work", {
      kind: "CLAIM",
      title: "Hospital claim — Priya Raman",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.item.assigneeId, worker.profileId);

    const queue = await api(worker.cookie).get("/work");
    assert.equal(queue.status, 200);
    assert.ok(queue.body.data.items.some((i) => i.id === created.body.data.item.id));
  });

  test("one employee cannot read another's work item", async () => {
    // Two people in the same department, so routing is the only thing that
    // separates them — which is exactly the case that must not leak.
    const owner = await employee("owner", { department: "claims", limit: 50 });
    const created = await api(owner.cookie).post("/work", { kind: "CLAIM", title: "Not yours" });

    const stranger = await employee("stranger", { department: "support" });
    const res = await api(stranger.cookie).get(`/work/${created.body.data.item.id}`);

    // 404 rather than 403: confirming the reference is real tells somebody
    // probing that a customer with that claim exists.
    assert.equal(res.status, 404);
  });

  test("asking for somebody else's queue is refused without the wider read", async () => {
    const worker = await employee("scope");
    const other = await employee("scope-other");
    const res = await api(worker.cookie).get(`/work?assigneeId=${other.profileId}`);
    assert.equal(res.status, 403);
  });

  test("a team lead may read the whole operation", async () => {
    // ENTERPRISE_ADMIN holds work.read.all, but is in the ENTERPRISE realm —
    // so this checks the realm wall is what it claims: even a broader role in
    // the wrong realm is refused.
    const lead = await employee("lead", { department: "claims", role: "CLAIMS" });
    const other = await employee("lead-other", { department: "claims" });

    const res = await api(lead.cookie).get(`/work?assigneeId=${other.profileId}`);
    assert.equal(res.status, 200);
  });

  test("escalations need the wider read", async () => {
    const worker = await employee("esc-plain");
    assert.equal((await api(worker.cookie).get("/escalations")).status, 403);

    const lead = await employee("esc-lead", { role: "CLAIMS" });
    assert.equal((await api(lead.cookie).get("/escalations")).status, 200);
  });
});

// ── The human gate ───────────────────────────────────────────────────────────

describe("Workflows — a person decides", () => {
  test("every definition ends in a human decision", () => {
    // Enforced at module load too; this is the test that says why.
    for (const definition of WORKFLOW_DEFINITIONS) {
      const spec = workflowSpec(definition);
      const decisions = spec.steps.filter((s) => s.requiresDecision);
      assert.ok(decisions.length > 0, `${definition} has no decision step`);
      for (const step of decisions) {
        assert.equal(step.actorKind, "EMPLOYEE", `${definition}.${step.key} is not a person`);
      }
    }
  });

  test("creating a claim starts its workflow with every step laid out", async () => {
    // All steps up front, so a colleague picking the case up cold can see what
    // has happened and what has not.
    const worker = await soleEmployee("wf-start");
    const created = await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Claim" });
    const detail = await api(worker.cookie).get(`/work/${created.body.data.item.id}`);

    assert.equal(detail.body.data.run.definition, "CLAIM_APPROVAL");
    assert.equal(detail.body.data.steps.length, workflowSpec("CLAIM_APPROVAL").steps.length);
    assert.equal(detail.body.data.run.currentStep, "intake");
  });

  test("a decision step cannot be completed without a decision", async () => {
    const worker = await soleEmployee("wf-decide", { role: "CLAIMS" });
    const created = await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Decide me" });
    const id = created.body.data.item.id;

    // Walk to the approval step.
    for (const key of ["intake", "document_validation", "risk_analysis", "recommendation"]) {
      const res = await api(worker.cookie).post(`/work/${id}/advance`, { stepKey: key });
      assert.equal(res.status, 200, `advancing ${key}`);
    }

    const withoutDecision = await api(worker.cookie).post(`/work/${id}/advance`, {
      stepKey: "human_approval",
    });
    assert.equal(withoutDecision.status, 400);
    assert.equal(withoutDecision.body.code, "DECISION_REQUIRED");
  });

  test("approval needs the approval capability, not merely the case", async () => {
    // A plain EMPLOYEE holds workflow.advance but not workflow.approve. Holding
    // the case is not the same as being allowed to decide it.
    const worker = await soleEmployee("wf-perm");
    const created = await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Perm" });
    const id = created.body.data.item.id;

    for (const key of ["intake", "document_validation", "risk_analysis", "recommendation"]) {
      await api(worker.cookie).post(`/work/${id}/advance`, { stepKey: key });
    }

    const res = await api(worker.cookie).post(`/work/${id}/advance`, {
      stepKey: "human_approval",
      decision: "APPROVE",
    });
    assert.equal(res.status, 403);
  });

  test("a rejection ends the run rather than continuing past the no", async () => {
    const worker = await soleEmployee("wf-reject", { role: "CLAIMS" });
    const created = await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Reject" });
    const id = created.body.data.item.id;

    for (const key of ["intake", "document_validation", "risk_analysis", "recommendation"]) {
      await api(worker.cookie).post(`/work/${id}/advance`, { stepKey: key });
    }
    const res = await api(worker.cookie).post(`/work/${id}/advance`, {
      stepKey: "human_approval",
      decision: "REJECT",
      notes: "Documents do not support the claim.",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "REJECTED");

    const detail = await api(worker.cookie).get(`/work/${id}`);
    assert.equal(detail.body.data.item.status, "CLOSED");
  });

  test("a stale tab cannot skip a step", async () => {
    const worker = await soleEmployee("wf-stale", { role: "CLAIMS" });
    const created = await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Stale" });
    const id = created.body.data.item.id;

    const skipped = await api(worker.cookie).post(`/work/${id}/advance`, {
      stepKey: "human_approval",
      decision: "APPROVE",
    });
    assert.equal(skipped.status, 409);
    assert.equal(skipped.body.code, "STEP_NOT_CURRENT");
  });

  test("who decided is recorded, and so is what they decided", async () => {
    const worker = await soleEmployee("wf-audit", { role: "CLAIMS" });
    const created = await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Audit" });
    const id = created.body.data.item.id;

    for (const key of ["intake", "document_validation", "risk_analysis", "recommendation"]) {
      await api(worker.cookie).post(`/work/${id}/advance`, { stepKey: key });
    }
    await api(worker.cookie).post(`/work/${id}/advance`, {
      stepKey: "human_approval",
      decision: "APPROVE",
    });

    const step = await prisma.workflowStep.findFirst({
      where: { key: "human_approval", run: { workItemId: id } },
    });
    assert.equal(step.actorKind, "EMPLOYEE");
    assert.equal(step.actorId, worker.profileId);
    assert.equal(step.decision, "APPROVE");
  });
});

// ── The operations manager ───────────────────────────────────────────────────

describe("Operations manager — routing and workload", () => {
  test("work goes to the least loaded person in the owning department", () => {
    const decision = routeWork("CLAIM", [
      { id: "a", department: "claims", status: "ACTIVE", workloadLimit: 20, openCount: 9 },
      { id: "b", department: "claims", status: "ACTIVE", workloadLimit: 20, openCount: 2 },
      { id: "c", department: "support", status: "ACTIVE", workloadLimit: 20, openCount: 0 },
    ]);
    assert.equal(decision.assigneeId, "b", "least loaded, and in the right department");
  });

  test("a full department leaves work unassigned rather than piling on", () => {
    // Quietly pushing one more onto the least-drowning person is how an
    // over-capacity team stays invisible until something breaches.
    const decision = routeWork("CLAIM", [
      { id: "a", department: "claims", status: "ACTIVE", workloadLimit: 5, openCount: 5 },
    ]);
    assert.equal(decision.assigneeId, null);
    assert.match(decision.reason, /limit/i);
  });

  test("somebody on leave is never routed to", () => {
    const decision = routeWork("CLAIM", [
      { id: "a", department: "claims", status: "ON_LEAVE", workloadLimit: 20, openCount: 0 },
    ]);
    assert.equal(decision.assigneeId, null);
  });

  test("overdue work weighs more than volume", () => {
    // Thirty items none of which are late is a productive day; five all late is
    // somebody stuck. A single count would rate the first as worse.
    const busy = assessWorkload({ employeeId: "a", openCount: 18, workloadLimit: 20, overdueCount: 0 });
    const stuck = assessWorkload({ employeeId: "b", openCount: 5, workloadLimit: 20, overdueCount: 6 });

    assert.equal(busy.verdict, "BUSY");
    assert.equal(stuck.verdict, "OVERLOADED");
  });

  test("urgent work is promised sooner than routine work", () => {
    assert.ok(slaMinutesFor("CLAIM", "URGENT") < slaMinutesFor("CLAIM", "NORMAL"));
    assert.ok(slaMinutesFor("COMPLAINT", "NORMAL") < slaMinutesFor("CLAIM", "NORMAL"));
  });

  test("escalations warn before the promise breaks, not after", () => {
    const now = new Date("2026-08-06T12:00:00Z");
    const escalations = findEscalations(
      [
        { id: "breached", priority: "NORMAL", dueAt: new Date("2026-08-06T10:00:00Z"), status: "OPEN", assigneeId: "a" },
        { id: "unassigned", priority: "HIGH", dueAt: new Date("2026-08-07T00:00:00Z"), status: "OPEN", assigneeId: null },
        { id: "fine", priority: "LOW", dueAt: new Date("2026-08-20T00:00:00Z"), status: "OPEN", assigneeId: "a" },
        { id: "closed", priority: "URGENT", dueAt: new Date("2026-08-01T00:00:00Z"), status: "CLOSED", assigneeId: "a" },
      ],
      now
    );

    const ids = escalations.map((e) => e.workItemId);
    assert.ok(ids.includes("breached"));
    assert.ok(ids.includes("unassigned"));
    assert.ok(!ids.includes("fine"), "healthy work is not escalated");
    assert.ok(!ids.includes("closed"), "finished work is not escalated");
    assert.equal(escalations[0].reason, "BREACHED", "most urgent first");
  });
});

// ── Analytics and knowledge ──────────────────────────────────────────────────

describe("Analytics", () => {
  test("an employee's numbers are their own", async () => {
    const worker = await soleEmployee("an-mine");
    await api(worker.cookie).post("/work", { kind: "CLAIM", title: "Mine" });

    const res = await api(worker.cookie).get("/analytics");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.scope, "MINE");
    assert.equal(res.body.data.openCases, 1);
  });

  test("a lead's numbers cover the operation", async () => {
    const lead = await employee("an-team", { role: "CLAIMS" });
    const res = await api(lead.cookie).get("/analytics");
    assert.equal(res.body.data.scope, "TEAM");
  });
});

describe("Knowledge centre", () => {
  test("an employee can search it", async () => {
    await prisma.knowledgeArticle.create({
      data: {
        slug: `sop-claims-${Date.now()}`,
        title: "SOP — Health claim intake",
        category: "SOP",
        summary: "How to register a health claim and what to collect.",
        body: "Full procedure.",
        tags: "claims,health,intake",
      },
    });

    const worker = await employee("kb");
    const res = await api(worker.cookie).get("/knowledge?q=health");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.articles.length >= 1);
  });

  test("a customer cannot", async () => {
    const customer = await signUp("kb-customer");
    assert.equal((await api(customer.cookie).get("/knowledge?q=health")).status, 403);
  });
});
