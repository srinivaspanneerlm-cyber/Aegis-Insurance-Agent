/**
 * The offline fallback advisor router must match domain keywords as whole
 * words, not substrings.
 *
 * When the AI microservice is unavailable, ai.service falls back to a keyword
 * heuristic to pick the domain (and therefore the advisor) for a reply. It used
 * `text.includes("car")`, so ordinary words that merely contain a keyword —
 * "care", "cardiac", "triple" — routed the customer to the wrong specialist.
 * These tests pin the corrected, word-boundary behaviour.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const { _detectFallbackDomain, _detectFallbackAgent } = require("../src/services/ai.service");

const domain = (message) => _detectFallbackDomain(message, [], undefined);

describe("_detectFallbackDomain — word-boundary matching", () => {
  test("does not misroute words that merely contain a keyword", () => {
    assert.equal(domain("I need care for my family"), "health"); // "care" ⊃ "car"
    assert.equal(domain("my cardiac treatment cover"), "health"); // "cardiac" ⊃ "car"
    assert.equal(domain("triple coverage please"), "health"); // "triple" ⊃ "trip"
  });

  test("still routes genuine domain keywords", () => {
    assert.equal(domain("I want car insurance"), "motor");
    assert.equal(domain("insurance for my bike"), "motor");
    assert.equal(domain("planning a trip abroad"), "travel");
    assert.equal(domain("home insurance for my house"), "home-property");
  });

  test("defaults to health when no domain keyword is present", () => {
    assert.equal(domain("hello, I need some advice"), "health");
  });

  test("an explicit productType overrides keyword detection", () => {
    assert.equal(_detectFallbackDomain("anything at all", [], "travel"), "travel");
  });

  test("scans conversation history, not just the latest message", () => {
    const history = [{ message: "earlier I mentioned my car" }];
    assert.equal(_detectFallbackDomain("and now what?", history, undefined), "motor");
  });
});

describe("_detectFallbackAgent — domain to advisor name", () => {
  test("maps each detected domain to its advisor", () => {
    assert.equal(_detectFallbackAgent("car insurance", [], undefined), "Alex AI");
    assert.equal(_detectFallbackAgent("trip abroad", [], undefined), "Ethan AI");
    assert.equal(_detectFallbackAgent("my house", [], undefined), "Emma AI");
    assert.equal(_detectFallbackAgent("care for my family", [], undefined), "Sarah AI");
  });
});
