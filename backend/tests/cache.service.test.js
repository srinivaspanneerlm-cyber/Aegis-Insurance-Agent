/**
 * The in-memory cache is the caching foundation the scale path builds on
 * (its interface is Redis-shaped). These tests pin its get/set/TTL/invalidation
 * and cache-aside (`wrap`) behaviour.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, beforeEach } = require("node:test");

const cache = require("../src/services/cache.service");

beforeEach(() => cache.clear());

describe("cache get/set", () => {
  test("returns a stored value", () => {
    cache.set("k1", { a: 1 }, 60);
    assert.deepEqual(cache.get("k1"), { a: 1 });
  });

  test("returns undefined for a missing key", () => {
    assert.equal(cache.get("absent"), undefined);
  });

  test("treats an expired entry as a miss", () => {
    cache.set("k2", "v", -1); // already expired
    assert.equal(cache.get("k2"), undefined);
  });
});

describe("cache invalidation", () => {
  test("del removes a single key", () => {
    cache.set("k", "v", 60);
    assert.equal(cache.del("k"), true);
    assert.equal(cache.get("k"), undefined);
  });

  test("delByPrefix clears matching keys and returns the count", () => {
    cache.set("policies:all", 1, 60);
    cache.set("policies:one", 2, 60);
    cache.set("companies:all", 3, 60);
    const removed = cache.delByPrefix("policies:");
    assert.equal(removed, 2);
    assert.equal(cache.get("policies:all"), undefined);
    assert.equal(cache.get("companies:all"), 3);
  });

  test("clear empties the store", () => {
    cache.set("a", 1, 60);
    cache.set("b", 2, 60);
    cache.clear();
    assert.equal(cache.stats().size, 0);
  });
});

describe("cache-aside wrap()", () => {
  test("runs the producer once, then serves from cache", async () => {
    let calls = 0;
    const producer = async () => { calls++; return "computed"; };

    const first = await cache.wrap("wk", 60, producer);
    const second = await cache.wrap("wk", 60, producer);

    assert.equal(first, "computed");
    assert.equal(second, "computed");
    assert.equal(calls, 1, "producer should only run on the miss");
  });

  test("does not cache null (never pins a transient failure)", async () => {
    let calls = 0;
    const producer = async () => { calls++; return null; };

    await cache.wrap("nullkey", 60, producer);
    await cache.wrap("nullkey", 60, producer);

    assert.equal(calls, 2, "null must not be cached, so the producer reruns");
  });
});

describe("cache stats", () => {
  test("exposes size, hits, misses and a 0..1 hitRate", () => {
    const s = cache.stats();
    assert.ok(["size", "hits", "misses", "hitRate"].every((k) => k in s));
    assert.ok(s.hitRate >= 0 && s.hitRate <= 1);
  });
});
