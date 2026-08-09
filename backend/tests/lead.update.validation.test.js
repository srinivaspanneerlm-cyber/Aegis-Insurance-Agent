/**
 * PUT /leads/:id — what the body may carry.
 *
 * This route had `validateParams` and no `validateBody`, and the service spread
 * the body into the row. Anything on the Lead model was writable: `deletedAt`
 * soft-deleted a lead without `lead.delete` — a capability no role holding
 * `lead.write` has — and `customerName`, `email` and `phone` could be
 * overwritten in the same request that "changed the status".
 *
 * The schema is exercised directly, which is where the decision lives, plus the
 * service's own allow-list, which is the second lock on the same door.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, afterEach } = require("node:test");

const { leadUpdateSchema } = require("../src/validations/schemas");
const { leadRepository } = require("../src/repositories");
const { leadService } = require("../src/services/lead.service");

const restores = [];
function stub(obj, name, impl) {
  const orig = obj[name];
  obj[name] = impl;
  restores.push(() => { obj[name] = orig; });
}
afterEach(() => { while (restores.length) restores.pop()(); });

describe("leadUpdateSchema — valid updates still pass", () => {
  test("accepts a status change, which is what the pipeline screen sends", () => {
    assert.equal(leadUpdateSchema({ status: "contacted" }), null);
  });

  test("accepts every status the platform itself produces", () => {
    for (const status of ["pending", "contacted", "qualified", "won", "lost", "approved"]) {
      assert.equal(leadUpdateSchema({ status }), null, `${status} should be accepted`);
    }
  });

  test("accepts a partial identity correction without demanding the rest", () => {
    assert.equal(leadUpdateSchema({ phone: "+919000000001" }), null);
  });

  test("accepts several allowed fields at once", () => {
    assert.equal(
      leadUpdateSchema({ customerName: "Meena R", email: "meena@example.com", status: "won" }),
      null
    );
  });
});

describe("leadUpdateSchema — unknown fields are refused", () => {
  test("refuses deletedAt, the soft-delete that bypassed lead.delete", () => {
    const errors = leadUpdateSchema({ status: "won", deletedAt: "2020-01-01T00:00:00.000Z" });
    assert.ok(errors, "deletedAt must not be accepted");
    assert.match(errors.join(" "), /cannot be updated: deletedAt/);
  });

  test("refuses assignedToId, id, version and createdAt", () => {
    for (const field of ["assignedToId", "id", "version", "createdAt"]) {
      const errors = leadUpdateSchema({ [field]: "x" });
      assert.ok(errors, `${field} must not be accepted`);
      assert.match(errors.join(" "), new RegExp(`cannot be updated: ${field}`));
    }
  });

  test("names every unknown field, not just the first", () => {
    const errors = leadUpdateSchema({ deletedAt: "x", version: 9 });
    assert.match(errors.join(" "), /deletedAt, version/);
  });

  test("refuses an empty body rather than writing an audit entry for nothing", () => {
    assert.ok(leadUpdateSchema({}));
  });
});

describe("leadUpdateSchema — wrong types are refused", () => {
  test("refuses a status outside the pipeline", () => {
    const errors = leadUpdateSchema({ status: "definitely-not-a-status" });
    assert.ok(errors);
    assert.match(errors.join(" "), /Status must be one of/);
  });

  test("refuses a non-string status", () => {
    assert.ok(leadUpdateSchema({ status: 42 }));
  });

  test("refuses a malformed email", () => {
    assert.ok(leadUpdateSchema({ email: "not-an-email" }));
  });

  test("refuses a name too short and a phone too short", () => {
    assert.ok(leadUpdateSchema({ customerName: "A" }));
    assert.ok(leadUpdateSchema({ phone: "123" }));
  });

  test("refuses non-string insuranceType and budget", () => {
    assert.ok(leadUpdateSchema({ insuranceType: 5 }));
    assert.ok(leadUpdateSchema({ budget: { amount: 1000 } }));
  });
});

describe("leadService.update — the second lock", () => {
  test("writes only the named columns, even if something unknown reaches it", async () => {
    let written = null;
    stub(leadRepository, "update", async (id, data) => { written = data; return { id, ...data }; });

    await leadService.update(
      "L1",
      { status: "won", deletedAt: "2020-01-01T00:00:00.000Z", version: 99 },
      "actor-1"
    );

    assert.deepEqual(Object.keys(written), ["status"]);
    assert.equal(written.deletedAt, undefined);
    assert.equal(written.version, undefined);
  });

  test("still passes through every field it is meant to", async () => {
    let written = null;
    stub(leadRepository, "update", async (id, data) => { written = data; return { id, ...data }; });

    await leadService.update(
      "L1",
      { customerName: "Meena R", email: "m@example.com", phone: "+919000000001", insuranceType: "health", budget: "2000-4000", status: "qualified" },
      "actor-1"
    );

    assert.deepEqual(Object.keys(written).sort(), [
      "budget", "customerName", "email", "insuranceType", "phone", "status",
    ]);
  });
});
