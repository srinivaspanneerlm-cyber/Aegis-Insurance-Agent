/**
 * The in-memory job queue is the async-work foundation the scale path builds on
 * (its interface is broker-shaped). These tests pin handler registration,
 * dispatch, and failure isolation.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const queue = require("../src/services/jobQueue.service");

describe("jobQueue register/enqueue", () => {
  test("register is chainable", () => {
    assert.equal(queue.register("noop", () => {}), queue);
  });

  test("enqueue dispatches the payload to the registered handler", async () => {
    const received = await new Promise((resolve) => {
      queue.register("capture", (payload) => resolve(payload));
      queue.enqueue("capture", { leadId: "L1" });
    });
    assert.deepEqual(received, { leadId: "L1" });
  });

  test("an unregistered job type is dropped, not thrown", async () => {
    const before = queue.stats().processed;
    assert.doesNotThrow(() => queue.enqueue("does-not-exist", {}));
    await new Promise((r) => setImmediate(r));
    assert.equal(queue.stats().processed, before, "no handler ran");
  });
});

describe("jobQueue failure isolation", () => {
  test("a throwing handler increments failed without propagating", async () => {
    const before = queue.stats().failed;
    queue.register("boom", () => { throw new Error("kaboom"); });

    await new Promise((resolve) => {
      queue.enqueue("boom", {});
      // give the setImmediate dispatch a couple of ticks to run + record
      setImmediate(() => setImmediate(resolve));
    });

    assert.equal(queue.stats().failed, before + 1);
  });
});

describe("jobQueue stats", () => {
  test("reports handlers, pendingTimers, processed and failed", () => {
    const s = queue.stats();
    assert.ok(["handlers", "pendingTimers", "processed", "failed"].every((k) => k in s));
  });
});
