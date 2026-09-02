/**
 * Canonical forms for registration and policy numbers.
 *
 * These feed indexed columns, so the property that matters is that two
 * renderings of the same identifier collapse to one value — and that the
 * function never rejects paperwork it does not recognise.
 */

process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const { normalizePolicyNumber, normalizeRegistration } = require("../src/consumer/normalize");

describe("normalizeRegistration", () => {
  test("the ways one plate gets typed all collapse to one value", () => {
    const forms = ["TN 09 AB 1234", "tn09ab1234", "TN-09-AB-1234", " TN09 AB1234 ", "tn.09.ab.1234"];
    const normalised = forms.map(normalizeRegistration);
    assert.deepEqual(new Set(normalised), new Set(["TN09AB1234"]));
  });

  test("different plates stay different", () => {
    assert.notEqual(normalizeRegistration("TN09AB1234"), normalizeRegistration("TN09AB1235"));
  });

  test("nothing supplied is null, not an empty string", () => {
    // An empty canonical value would collide with every other empty one in the
    // per-owner unique index, so a second vehicle with no plate would be refused.
    for (const value of [null, undefined, "", "   ", "---", "//", 42, {}]) {
      assert.equal(normalizeRegistration(value), null, `${JSON.stringify(value)} should be null`);
    }
  });

  test("it is idempotent — normalising twice changes nothing", () => {
    const once = normalizeRegistration("TN 09 AB 1234");
    assert.equal(normalizeRegistration(once), once);
  });

  test("an unfamiliar format is still normalised, never refused", () => {
    // Older and out-of-state formats must not be turned away at the door.
    assert.equal(normalizeRegistration("MYS 4021"), "MYS4021");
    assert.equal(normalizeRegistration("DL1CAB0001"), "DL1CAB0001");
  });
});

describe("normalizePolicyNumber", () => {
  test("insurer punctuation is removed", () => {
    const forms = ["POL/2026/000123", "pol-2026-000123", "POL 2026 000123"];
    assert.deepEqual(new Set(forms.map(normalizePolicyNumber)), new Set(["POL2026000123"]));
  });

  test("digits are preserved exactly, including leading zeros", () => {
    // Trimming a leading zero would merge two genuinely different policies.
    assert.equal(normalizePolicyNumber("0001234"), "0001234");
    assert.notEqual(normalizePolicyNumber("0001234"), normalizePolicyNumber("1234"));
  });

  test("nothing supplied is null", () => {
    for (const value of [null, undefined, "", "  ", "///"]) {
      assert.equal(normalizePolicyNumber(value), null);
    }
  });

  test("it is idempotent", () => {
    const once = normalizePolicyNumber("POL/2026/000123");
    assert.equal(normalizePolicyNumber(once), once);
  });
});
