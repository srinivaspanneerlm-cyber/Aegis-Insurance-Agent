/**
 * Lead controller — request → controller → repository path.
 *
 * The repository singletons and the job queue are stubbed (and restored) so the
 * controller's own logic (status defaulting, response shape, 404 handling,
 * background auto-qualify scheduling) is exercised without a database.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, afterEach } = require("node:test");

const { leadRepository } = require("../src/repositories");
const jobQueue = require("../src/services/jobQueue.service");
const AppError = require("../src/utils/appError");
const leadController = require("../src/controllers/lead.controller");

const restores = [];
function stub(obj, name, impl) {
  const orig = obj[name];
  obj[name] = impl;
  restores.push(() => { obj[name] = orig; });
}
afterEach(() => { while (restores.length) restores.pop()(); });

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

describe("createLead", () => {
  test("persists a pending lead, schedules auto-qualify, and returns 201", async () => {
    let scheduled = null;
    stub(leadRepository, "create", async (data) => ({ id: "L1", ...data }));
    stub(jobQueue, "schedule", (type, payload) => { scheduled = { type, payload }; });

    const res = makeRes();
    const errs = [];
    leadController.createLead(
      { body: { customerName: "A", email: "a@x.com", phone: "1", insuranceType: "Health", budget: "850" } },
      res,
      (e) => errs.push(e)
    );
    await flush();

    assert.equal(errs.length, 0);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.lead.id, "L1");
    assert.equal(res.body.data.lead.status, "pending");
    assert.deepEqual(scheduled.payload, { leadId: "L1" });
  });
});

describe("getLeads", () => {
  test("returns a bounded page of leads with a results count and pagination", async () => {
    stub(leadRepository, "paginate", async () => ({
      items: [{ id: "1" }, { id: "2" }],
      total: 2,
      page: 1,
      limit: 100,
      pages: 1,
    }));
    const res = makeRes();
    leadController.getLeads({ query: {} }, res, () => {});
    await flush();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.results, 2);
    assert.equal(res.body.data.leads.length, 2);
    assert.equal(res.body.pagination.total, 2);
  });
});

describe("getLeadById", () => {
  test("returns the lead when found", async () => {
    stub(leadRepository, "findById", async (id) => ({ id, customerName: "Found" }));
    const res = makeRes();
    leadController.getLeadById({ params: { id: "L9" } }, res, () => {});
    await flush();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.lead.customerName, "Found");
  });

  test("forwards a 404 AppError when not found", async () => {
    stub(leadRepository, "findById", async () => null);
    const res = makeRes();
    const errs = [];
    leadController.getLeadById({ params: { id: "missing" } }, res, (e) => errs.push(e));
    await flush();
    assert.equal(res.statusCode, null, "no response body on the not-found path");
    assert.equal(errs.length, 1);
    assert.ok(errs[0] instanceof AppError);
    assert.equal(errs[0].statusCode, 404);
  });
});

describe("updateLead / deleteLead", () => {
  test("updateLead returns the updated lead", async () => {
    stub(leadRepository, "update", async (id, data) => ({ id, ...data }));
    const res = makeRes();
    leadController.updateLead({ params: { id: "L1" }, body: { status: "approved" } }, res, () => {});
    await flush();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.lead.status, "approved");
  });

  test("deleteLead returns 204", async () => {
    let deleted = null;
    stub(leadRepository, "delete", async (id) => { deleted = id; });
    const res = makeRes();
    leadController.deleteLead({ params: { id: "L1" } }, res, () => {});
    await flush();
    assert.equal(res.statusCode, 204);
    assert.equal(deleted, "L1");
  });
});
