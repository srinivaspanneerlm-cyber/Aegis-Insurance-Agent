/**
 * Policy controller — request → controller → repository/cache path.
 *
 * Repositories are stubbed; the real cache singleton is used so the cache-aside
 * read path and the create-time invalidation are exercised end to end.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, afterEach, beforeEach } = require("node:test");

const { policyRepository, companyRepository } = require("../src/repositories");
const cache = require("../src/services/cache.service");
const AppError = require("../src/utils/appError");
const policyController = require("../src/controllers/policy.controller");

const restores = [];
function stub(obj, name, impl) {
  const orig = obj[name];
  obj[name] = impl;
  restores.push(() => { obj[name] = orig; });
}
afterEach(() => { while (restores.length) restores.pop()(); });
beforeEach(() => cache.clear());

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

describe("createPolicy", () => {
  test("rejects with 404 when the company does not exist", async () => {
    stub(companyRepository, "findById", async () => null);
    const res = makeRes();
    const errs = [];
    policyController.createPolicy({ body: { companyId: "nope" } }, res, (e) => errs.push(e));
    await flush();
    assert.equal(errs.length, 1);
    assert.ok(errs[0] instanceof AppError);
    assert.equal(errs[0].statusCode, 404);
  });

  test("creates the policy and invalidates the catalogue cache", async () => {
    let invalidated = null;
    stub(companyRepository, "findById", async (id) => ({ id, companyName: "Acme" }));
    stub(policyRepository, "create", async (data) => ({ id: "P1", ...data }));
    stub(cache, "delByPrefix", (prefix) => { invalidated = prefix; return 1; });

    const res = makeRes();
    const errs = [];
    policyController.createPolicy(
      { body: { policyName: "Shield", premium: 850, coverage: "1cr", companyId: "C1" } },
      res,
      (e) => errs.push(e)
    );
    await flush();

    assert.equal(errs.length, 0);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.policy.id, "P1");
    assert.equal(invalidated, "policies:");
  });
});

describe("getPolicies (cache-aside)", () => {
  test("returns the catalogue and serves the second read from cache", async () => {
    let dbCalls = 0;
    stub(policyRepository, "findMany", async () => {
      dbCalls++;
      return [{ id: "P1" }, { id: "P2" }];
    });

    const res1 = makeRes();
    policyController.getPolicies({}, res1, () => {});
    await flush();
    const res2 = makeRes();
    policyController.getPolicies({}, res2, () => {});
    await flush();

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.results, 2);
    assert.equal(res2.body.results, 2);
    assert.equal(dbCalls, 1, "second read should hit the cache, not the repository");
  });
});
