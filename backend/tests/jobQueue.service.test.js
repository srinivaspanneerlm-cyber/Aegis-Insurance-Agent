/**
 * The in-memory job queue is the async-work foundation the scale path builds on
 * (its interface is broker-shaped). These tests pin handler registration,
 * dispatch, and failure isolation.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";
// Retry with zero backoff so the retry/dead-letter tests run instantly.
process.env.JOB_BACKOFF_MS = "0";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const queue = require("../src/services/jobQueue.service");

// Poll a predicate for up to `ms` (retries dispatch across macrotasks).
async function waitFor(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setImmediate(r));
  }
  return false;
}

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

describe("jobQueue failure isolation & retry", () => {
  test("a persistently throwing handler is retried then dead-lettered (failed++), not propagated", async () => {
    const before = queue.stats().failed;
    queue.register("boom", () => { throw new Error("kaboom"); });

    assert.doesNotThrow(() => queue.enqueue("boom", {}));
    const done = await waitFor(() => queue.stats().failed === before + 1);

    assert.ok(done, "dead-lettered after exhausting retries");
  });

  test("a handler that fails then succeeds is retried to success (processed++)", async () => {
    const before = queue.stats().processed;
    let attempts = 0;
    queue.register("flaky", () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient");
    });

    queue.enqueue("flaky", {});
    const done = await waitFor(() => queue.stats().processed === before + 1);

    assert.ok(done, "recovered via retry");
    assert.equal(attempts, 3, "retried until success");
  });
});

describe("jobQueue stats", () => {
  test("reports handlers, pendingTimers, processed and failed", () => {
    const s = queue.stats();
    assert.ok(["handlers", "pendingTimers", "processed", "failed"].every((k) => k in s));
  });
});
