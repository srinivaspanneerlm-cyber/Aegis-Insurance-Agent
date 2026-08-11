/**
 * The document platform, driven through the real app.
 *
 * Two properties decide whether this is safe, and they are what these tests are
 * for: a customer can only ever reach their own documents, and no machine can
 * mark one verified. Everything else follows from those.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3000,http://localhost:3102";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-docs-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, before, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { resolveRequirements, completeness, DOCUMENT_CATALOGUE } = require("../src/documents/requirements");
const { registerPipeline, resetPipeline, simulatedPipeline } = require("../src/documents/services");
const { documentService } = require("../src/services/document.service");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

// Task 9.4. Every cross-customer path in document.service.ts now scopes by
// organisation — it used to be role alone. Most existing tests below want
// "same organisation, should work" as their baseline, so one real
// organisation is shared across them; a second exists only for the tests that
// prove the opposite.
let PRIMARY_ORG, OTHER_ORG;
before(async () => {
  PRIMARY_ORG = await prisma.organization.create({
    data: { slug: `docs-primary-${Date.now()}`, name: "Primary Org" },
  });
  OTHER_ORG = await prisma.organization.create({
    data: { slug: `docs-other-${Date.now()}`, name: "Other Org" },
  });
});

after(async () => {
  resetPipeline();
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag, realm = "CUSTOMER", role = "CUSTOMER", organizationId = null) {
  seq += 1;
  const email = `doc-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app).post("/api/v1/auth/register").set("Origin", ORIGIN)
    .send({ name: `Subject ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201);
  if (realm !== "CUSTOMER" || organizationId) {
    await prisma.user.update({
      where: { id: res.body.data.user.id },
      data: { realm, role, emailVerifiedAt: new Date(), ...(organizationId ? { organizationId } : {}) },
    });
  }
  return { userId: res.body.data.user.id, email, cookie: cookieHeader(res), organizationId };
}

/** A document row, as the upload route would have produced. */
const upload = (ownerId, over = {}) =>
  prisma.uploadedDocument.create({
    data: {
      filename: over.filename ?? "rc-book.pdf",
      filepath: `/tmp/${Date.now()}-${seq}.pdf`,
      ownerId,
      mimeType: "application/pdf",
      sizeBytes: 120_000,
      contentHash: `hash-${Date.now()}-${seq++}`,
      ...over,
    },
  });

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/documents${p}`).set("Cookie", cookie),
  post: (p, body) => request(app).post(`/api/v1/documents${p}`).set("Cookie", cookie).set("Origin", ORIGIN).send(body),
  del: (p) => request(app).delete(`/api/v1/documents${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
});

// ── Requirements are resolved, not hardcoded ─────────────────────────────────

describe("Requirements", () => {
  test("a motor claim asks for different documents than a motor application", () => {
    // The whole reason this is a resolver rather than a list in the interface.
    const application = resolveRequirements({ domain: "motor", purpose: "APPLICATION" });
    const claim = resolveRequirements({ domain: "motor", purpose: "CLAIM" });

    const photosOnApplication = application.find((r) => r.spec.key === "vehicle_photos");
    const photosOnClaim = claim.find((r) => r.spec.key === "vehicle_photos");

    assert.equal(photosOnApplication.required, false);
    assert.equal(photosOnClaim.required, true);
  });

  test("a fact changes what is asked for", () => {
    const personal = resolveRequirements({ domain: "motor", purpose: "APPLICATION" });
    const commercial = resolveRequirements({
      domain: "motor", purpose: "APPLICATION", facts: { commercialVehicle: true },
    });

    assert.ok(!personal.some((r) => r.spec.key === "address_proof"));
    assert.ok(commercial.some((r) => r.spec.key === "address_proof"));
  });

  test("a tenant is asked for proof of address rather than a deed", () => {
    const owner = resolveRequirements({ domain: "home-property", purpose: "APPLICATION" });
    const tenant = resolveRequirements({
      domain: "home-property", purpose: "APPLICATION", facts: { tenant: true },
    });

    assert.ok(owner.some((r) => r.spec.key === "property_deed"));
    assert.ok(!tenant.some((r) => r.spec.key === "property_deed"));
    assert.ok(tenant.some((r) => r.spec.key === "address_proof"));
  });

  test("a document already held is never asked for again", () => {
    const requirements = resolveRequirements({
      domain: "travel", purpose: "APPLICATION", alreadyHeld: ["id_proof", "passport"],
    });
    assert.ok(!requirements.some((r) => ["id_proof", "passport"].includes(r.spec.key)));
  });

  test("every requirement carries a reason a customer can read", () => {
    // "We need your RC book" is far less useful than why.
    for (const domain of ["motor", "health", "travel", "home-property"]) {
      for (const requirement of resolveRequirements({ domain, purpose: "CLAIM" })) {
        assert.ok(requirement.reason.length > 15, `${domain}/${requirement.spec.key}`);
      }
    }
  });

  test("every catalogue entry declares what it accepts", () => {
    for (const [key, spec] of Object.entries(DOCUMENT_CATALOGUE)) {
      assert.ok(spec.accepts.length > 0, `${key} accepts nothing`);
      assert.ok(spec.reason.length > 15, `${key} has no usable reason`);
    }
  });

  test("completeness measures what is outstanding, not what exists", () => {
    const result = completeness([
      { required: true, status: "SUPPLIED" },
      { required: true, status: "PENDING" },
      { required: false, status: "PENDING" },
    ]);
    assert.equal(result.requiredOutstanding, 1);
    assert.equal(result.supplied, 1);
  });
});

// ── Scope ────────────────────────────────────────────────────────────────────

describe("Documents — a customer sees only their own", () => {
  test("the list is built from the caller, not from a parameter", async () => {
    const alice = await account("alice");
    const mallory = await account("mallory");
    await upload(alice.userId, { filename: "alice-secret.pdf" });

    const res = await api(mallory.cookie).get("/");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.scope, "MINE");
    assert.ok(!JSON.stringify(res.body).includes("alice-secret.pdf"));
  });

  test("reading somebody else's document answers as if it does not exist", async () => {
    // Confirming an id is real tells a prober that a customer with that
    // document exists.
    const alice = await account("owner");
    const mallory = await account("stranger");
    const doc = await upload(alice.userId);

    assert.equal((await api(mallory.cookie).get(`/${doc.id}`)).status, 404);
  });

  test("production refuses uploads when no virus scanner is registered", async () => {
    // The simulated scanner calls everything clean. Shipping that to production
    // means accepting executables from the public internet and then telling a
    // reviewer they were scanned, so the pipeline refuses to run at all.
    const owner = await account("scanner-gate", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const doc = await upload(owner.userId, { organizationId: PRIMARY_ORG.id });
    const officer = { id: "system-probe", role: "EMPLOYEE", organizationId: PRIMARY_ORG.id };
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await assert.rejects(() => documentService.process(doc.id, officer), /unavailable/i);
    } finally {
      process.env.NODE_ENV = previous;
    }

    // Registering a real scanner lifts the block.
    process.env.NODE_ENV = "production";
    registerPipeline({
      virusScan: {
        async scan() {
          return { ok: true, simulated: false, summary: "Scanned, clean.", data: { clean: true, signature: null } };
        },
      },
    });
    try {
      const result = await documentService.process(doc.id, officer);
      assert.equal(result.status, "PENDING_REVIEW");
    } finally {
      resetPipeline();
      process.env.NODE_ENV = previous;
    }
  });

  test("a verifier can read a document they are asked to decide on", async () => {
    // The queue shows it and the decision endpoint accepts it, so refusing the
    // detail would ask somebody to judge a document they cannot open — which is
    // how a verification queue gets rubber-stamped.
    const alice = await account("verifier-owner", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const officer = await account("verifier", "EMPLOYEE", "EMPLOYEE", PRIMARY_ORG.id);
    const doc = await upload(alice.userId, { status: "PENDING_REVIEW", organizationId: PRIMARY_ORG.id });

    const res = await api(officer.cookie).get(`/${doc.id}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.events));
  });

  // Task 9.4. The role alone used to be enough — work.read.all or work.write
  // opened every organisation's documents. Same fixture as the test above,
  // different organisation for the reader, and the answer must flip.
  test("a verifier in a different organisation cannot read it", async () => {
    const alice = await account("verifier-owner-2", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const outsider = await account("outside-verifier", "EMPLOYEE", "EMPLOYEE", OTHER_ORG.id);
    const doc = await upload(alice.userId, { status: "PENDING_REVIEW", organizationId: PRIMARY_ORG.id });

    assert.equal((await api(outsider.cookie).get(`/${doc.id}`)).status, 404);
  });

  test("an employee with the wider read sees everything in their own organisation", async () => {
    const alice = await account("scoped", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    await upload(alice.userId, { organizationId: PRIMARY_ORG.id });
    const lead = await account("lead", "EMPLOYEE", "CLAIMS", PRIMARY_ORG.id);

    const res = await api(lead.cookie).get("/");
    assert.equal(res.body.data.scope, "ALL");
    assert.ok(res.body.data.total >= 1);
  });

  test("the wider read does not cross an organisation boundary", async () => {
    const alice = await account("other-scoped", "CUSTOMER", "CUSTOMER", OTHER_ORG.id);
    await upload(alice.userId, { organizationId: OTHER_ORG.id, filename: "other-org-only.pdf" });
    const lead = await account("primary-lead", "EMPLOYEE", "CLAIMS", PRIMARY_ORG.id);

    const res = await api(lead.cookie).get("/");
    assert.ok(!JSON.stringify(res.body).includes("other-org-only.pdf"));
  });

  test("an employee holding the wider read but attached to no organisation sees nothing", async () => {
    // Not the customer fallback either — a role that promises "everyone" and
    // cannot safely be given everyone gets an empty result, not somebody
    // else's organisation and not its own uploads (it has none).
    const alice = await account("orgless-scoped", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    await upload(alice.userId, { organizationId: PRIMARY_ORG.id });
    const orphanLead = await account("orphan-lead", "EMPLOYEE", "CLAIMS"); // no organisationId

    const res = await api(orphanLead.cookie).get("/");
    assert.equal(res.body.data.scope, "MINE");
    assert.equal(res.body.data.total, 0);
  });

  test("the file path never reaches a client", async () => {
    // It is a server-side location. A client that knows it has a head start on
    // anything the storage layer gets wrong.
    const alice = await account("path");
    const doc = await upload(alice.userId);

    const list = await api(alice.cookie).get("/");
    const detail = await api(alice.cookie).get(`/${doc.id}`);
    for (const body of [list.body, detail.body]) {
      assert.ok(!JSON.stringify(body).includes("filepath"));
      assert.ok(!JSON.stringify(body).includes("/tmp/"));
    }
  });

  test("deleting somebody else's document is refused", async () => {
    const alice = await account("del-owner");
    const mallory = await account("del-stranger");
    const doc = await upload(alice.userId);

    assert.equal((await api(mallory.cookie).del(`/${doc.id}`)).status, 404);
    const still = await prisma.uploadedDocument.findUnique({ where: { id: doc.id } });
    assert.equal(still.deletedAt, null);
  });

  // Task 9.4. work.write let an employee delete any organisation's document —
  // not just a stranger's, a whole different tenant's.
  test("an employee in a different organisation cannot delete it either", async () => {
    const alice = await account("del-owner-2", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const outsider = await account("del-outside-officer", "EMPLOYEE", "EMPLOYEE", OTHER_ORG.id);
    const doc = await upload(alice.userId, { organizationId: PRIMARY_ORG.id });

    assert.equal((await api(outsider.cookie).del(`/${doc.id}`)).status, 404);
    const still = await prisma.uploadedDocument.findUnique({ where: { id: doc.id } });
    assert.equal(still.deletedAt, null);
  });

  test("a customer may delete their own, and it is soft", async () => {
    // A verified document is evidence in a claim. Delete removes it from the
    // customer's list, never from the record.
    const alice = await account("del-own");
    const doc = await upload(alice.userId);

    assert.equal((await api(alice.cookie).del(`/${doc.id}`)).status, 200);
    const row = await prisma.uploadedDocument.findUnique({ where: { id: doc.id } });
    assert.ok(row, "the row survives");
    assert.ok(row.deletedAt, "but it is marked deleted");
  });

  test("an unauthenticated request is refused", async () => {
    assert.equal((await request(app).get("/api/v1/documents")).status, 401);
  });
});

// ── The pipeline ─────────────────────────────────────────────────────────────

describe("Pipeline", () => {
  // Task 9.4, through the real route rather than a direct service call: an
  // employee could re-run the extraction/fraud pipeline — reading the file,
  // scoring it — on any organisation's document, not just their own.
  test("re-running the pipeline on another organisation's document is refused", async () => {
    const alice = await account("process-owner", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const outsider = await account("process-outsider", "EMPLOYEE", "EMPLOYEE", OTHER_ORG.id);
    const doc = await upload(alice.userId, { organizationId: PRIMARY_ORG.id });

    const res = await api(outsider.cookie).post(`/${doc.id}/process`, {});
    assert.equal(res.status, 404);
  });

  test("processing leaves a document waiting for a person, never verified", async () => {
    // The core rule. A machine may move a document to review and explain why;
    // only a person decides.
    const alice = await account("pipe", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const doc = await upload(alice.userId, { organizationId: PRIMARY_ORG.id });

    const result = await documentService.process(doc.id, { id: "system", role: "EMPLOYEE", organizationId: PRIMARY_ORG.id });
    assert.equal(result.status, "PENDING_REVIEW");

    const row = await prisma.uploadedDocument.findUnique({ where: { id: doc.id } });
    assert.equal(row.status, "PENDING_REVIEW");
    assert.equal(row.verifiedAt, null);
  });

  test("every stage records what it did, including not running", async () => {
    // A timeline that omits the stages that did nothing leaves a reader unable
    // to tell "clean" from "never scanned".
    const alice = await account("timeline", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const doc = await upload(alice.userId, { organizationId: PRIMARY_ORG.id });
    await documentService.process(doc.id, { id: "system", role: "EMPLOYEE", organizationId: PRIMARY_ORG.id });
    // Timeline writes are fire-and-forget so a stage never delays the pipeline.
    // Give them a moment to land before asserting on them.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const events = await prisma.documentEvent.findMany({ where: { documentId: doc.id } });
    const stages = events.map((e) => e.stage);
    for (const stage of ["UPLOADED", "SCANNED", "EXTRACTED", "VALIDATED", "ANALYSED", "PENDING_REVIEW"]) {
      assert.ok(stages.includes(stage), `${stage} is missing from the timeline`);
    }
    assert.ok(
      events.some((e) => /did not run|not scanned/i.test(e.summary)),
      "a simulated stage says so in the timeline"
    );
  });

  test("a document that fails the scan is rejected and never read", async () => {
    registerPipeline({
      virusScan: {
        async scan() {
          return {
            ok: true, simulated: false, summary: "Signature matched.",
            data: { clean: false, signature: "EICAR-TEST" },
          };
        },
      },
      ocr: {
        async extractText() {
          throw new Error("OCR must never run on an infected document");
        },
      },
    });

    const alice = await account("infected", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const doc = await upload(alice.userId, { organizationId: PRIMARY_ORG.id });
    const result = await documentService.process(doc.id, { id: "system", role: "EMPLOYEE", organizationId: PRIMARY_ORG.id });

    assert.equal(result.status, "REJECTED");
    resetPipeline();
  });

  test("the simulated pipeline marks itself simulated", async () => {
    // A stub returning plausible OCR text would eventually be mistaken for real
    // extraction, and somebody would decide a claim on it.
    const ocr = await simulatedPipeline.ocr.extractText({ id: "x", filename: "f", mimeType: null, sizeBytes: null, contentHash: null, filepath: "/x" });
    assert.equal(ocr.simulated, true);
    assert.equal(ocr.data, null);
  });
});

// ── Verification ─────────────────────────────────────────────────────────────

describe("Verification", () => {
  test("a customer cannot verify their own document", async () => {
    const alice = await account("selfverify");
    const doc = await upload(alice.userId, { status: "PENDING_REVIEW" });

    const res = await api(alice.cookie).post(`/${doc.id}/decision`, { decision: "VERIFY" });
    assert.equal(res.status, 403);
  });

  test("an employee can, and their id is recorded", async () => {
    const alice = await account("verified-owner", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const officer = await account("officer", "EMPLOYEE", "EMPLOYEE", PRIMARY_ORG.id);
    const doc = await upload(alice.userId, { status: "PENDING_REVIEW", organizationId: PRIMARY_ORG.id });

    const res = await api(officer.cookie).post(`/${doc.id}/decision`, { decision: "VERIFY" });
    assert.equal(res.status, 200);

    const row = await prisma.uploadedDocument.findUnique({ where: { id: doc.id } });
    assert.equal(row.status, "VERIFIED");
    assert.equal(row.verifiedById, officer.userId);
  });

  // Task 9.4. Same shape as the read-side proof above: an employee in a
  // different organisation holds the identical work.write capability and must
  // still be refused — this is the state-changing half of that same gap.
  test("an employee in a different organisation cannot decide on it", async () => {
    const alice = await account("verified-owner-2", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const outsider = await account("outside-officer", "EMPLOYEE", "EMPLOYEE", OTHER_ORG.id);
    const doc = await upload(alice.userId, { status: "PENDING_REVIEW", organizationId: PRIMARY_ORG.id });

    const res = await api(outsider.cookie).post(`/${doc.id}/decision`, { decision: "VERIFY" });
    assert.equal(res.status, 404);

    const row = await prisma.uploadedDocument.findUnique({ where: { id: doc.id } });
    assert.equal(row.status, "PENDING_REVIEW", "the document must be untouched");
  });

  test("a rejection without a reason is refused", async () => {
    // The customer is shown it. Without one they upload the same thing again.
    const alice = await account("noreason-owner", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const officer = await account("noreason-officer", "EMPLOYEE", "EMPLOYEE", PRIMARY_ORG.id);
    const doc = await upload(alice.userId, { status: "PENDING_REVIEW", organizationId: PRIMARY_ORG.id });

    const res = await api(officer.cookie).post(`/${doc.id}/decision`, { decision: "REJECT" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "REASON_REQUIRED");
  });

  test("verifying a document satisfies the request it answered", async () => {
    const alice = await account("fulfil", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const officer = await account("fulfil-officer", "EMPLOYEE", "EMPLOYEE", PRIMARY_ORG.id);

    await api(officer.cookie).post("/requests", {
      subjectId: alice.userId, domain: "motor", purpose: "APPLICATION",
    });
    const doc = await upload(alice.userId, {
      status: "PENDING_REVIEW", documentKey: "rc_book", organizationId: PRIMARY_ORG.id,
    });
    await api(officer.cookie).post(`/${doc.id}/decision`, { decision: "VERIFY" });

    const fulfilled = await prisma.documentRequest.findFirst({
      where: { subjectId: alice.userId, documentKey: "rc_book" },
    });
    assert.equal(fulfilled.status, "SUPPLIED");
  });

  test("the queue is oldest first", async () => {
    // A queue sorted newest-first starves its own bottom.
    const alice = await account("queue-owner", "CUSTOMER", "CUSTOMER", PRIMARY_ORG.id);
    const officer = await account("queue-officer", "EMPLOYEE", "EMPLOYEE", PRIMARY_ORG.id);

    const older = await upload(alice.userId, {
      status: "PENDING_REVIEW", filename: "older.pdf", organizationId: PRIMARY_ORG.id,
    });
    await prisma.uploadedDocument.update({
      where: { id: older.id },
      data: { uploadedAt: new Date(Date.now() - 86_400_000) },
    });
    await upload(alice.userId, {
      status: "PENDING_REVIEW", filename: "newer.pdf", organizationId: PRIMARY_ORG.id,
    });

    const res = await api(officer.cookie).get("/queue/pending");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.documents[0].filename, "older.pdf");
  });

  test("the queue never shows another organisation's documents", async () => {
    const alice = await account("queue-owner-2", "CUSTOMER", "CUSTOMER", OTHER_ORG.id);
    const officer = await account("queue-officer-2", "EMPLOYEE", "EMPLOYEE", PRIMARY_ORG.id);
    await upload(alice.userId, {
      status: "PENDING_REVIEW", filename: "not-yours.pdf", organizationId: OTHER_ORG.id,
    });

    const res = await api(officer.cookie).get("/queue/pending");
    assert.ok(!JSON.stringify(res.body).includes("not-yours.pdf"));
  });

  test("a customer cannot see the verification queue", async () => {
    const alice = await account("queue-customer");
    assert.equal((await api(alice.cookie).get("/queue/pending")).status, 403);
  });
});

// ── Requests through the API ─────────────────────────────────────────────────

describe("Document requests", () => {
  test("requesting twice updates rather than duplicates", async () => {
    // An agent discovering mid-conversation that a vehicle is commercial should
    // add one requirement, not a second copy of everything.
    const alice = await account("dupe");
    const officer = await account("dupe-officer", "EMPLOYEE", "EMPLOYEE");

    await api(officer.cookie).post("/requests", { subjectId: alice.userId, domain: "motor", purpose: "APPLICATION" });
    const first = await prisma.documentRequest.count({ where: { subjectId: alice.userId } });

    await api(officer.cookie).post("/requests", {
      subjectId: alice.userId, domain: "motor", purpose: "APPLICATION",
      facts: { commercialVehicle: true },
    });
    const second = await prisma.documentRequest.count({ where: { subjectId: alice.userId } });

    assert.equal(second, first + 1, "exactly one new requirement");
  });

  test("a customer sees their own outstanding requests with formats attached", async () => {
    const alice = await account("reqs");
    const officer = await account("reqs-officer", "EMPLOYEE", "EMPLOYEE");
    await api(officer.cookie).post("/requests", { subjectId: alice.userId, domain: "travel", purpose: "APPLICATION" });

    const res = await api(alice.cookie).get("/requirements");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.requests.length > 0);
    for (const req of res.body.data.requests) {
      assert.ok(req.accepts.length > 0, `${req.documentKey} has no accepted formats`);
      assert.ok(req.reason, `${req.documentKey} has no reason`);
    }
  });

  test("a customer cannot request documents from somebody else", async () => {
    const alice = await account("req-customer");
    const bob = await account("req-victim");
    const res = await api(alice.cookie).post("/requests", { subjectId: bob.userId, domain: "motor" });
    assert.equal(res.status, 403);
  });
});

// ── Statistics ───────────────────────────────────────────────────────────────

describe("Statistics", () => {
  test("counts only, with processing time declared unavailable", async () => {
    const admin = await account("stats", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).get("/stats/overview");

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.data.total, "number");
    assert.equal(res.body.data.processingTime.available, false);
    assert.ok(!JSON.stringify(res.body).includes("filename"), "no document contents");
  });

  test("a customer cannot read platform statistics", async () => {
    const alice = await account("stats-customer");
    assert.equal((await api(alice.cookie).get("/stats/overview")).status, 403);
  });
});
