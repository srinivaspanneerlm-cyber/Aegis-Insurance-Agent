/**
 * HTTP keep-alive timeout resolution + invariant (Phase 9.2).
 *
 * The header-read timer must outlast the keep-alive timer, or requests get cut
 * short mid-connection; the keep-alive timer must in turn outlast the upstream
 * proxy's idle timeout, or the proxy races Node into intermittent 502s. This
 * guards the pure resolver that config/env applies to the http.Server at boot.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const resolveServerTimeouts = require("../src/config/serverTimeouts");

describe("server keep-alive timeouts", () => {
  test("defaults keep headersTimeout above keepAliveTimeout, both positive", () => {
    const t = resolveServerTimeouts({});
    assert.ok(t.keepAliveTimeoutMs > 0, "keepAlive must be positive");
    assert.ok(
      t.headersTimeoutMs > t.keepAliveTimeoutMs,
      "headers must exceed keepAlive"
    );
    assert.equal(t.errors.length, 0);
  });

  test("parses valid custom values", () => {
    const t = resolveServerTimeouts({
      KEEPALIVE_TIMEOUT_MS: "70000",
      HEADERS_TIMEOUT_MS: "75000",
    });
    assert.equal(t.keepAliveTimeoutMs, 70000);
    assert.equal(t.headersTimeoutMs, 75000);
    assert.equal(t.errors.length, 0);
  });

  test("flags the invariant violation when headers <= keepAlive", () => {
    const t = resolveServerTimeouts({
      KEEPALIVE_TIMEOUT_MS: "70000",
      HEADERS_TIMEOUT_MS: "60000",
    });
    assert.equal(t.errors.length, 1);
    assert.match(t.errors[0], /HEADERS_TIMEOUT_MS/);
  });

  test("falls back to defaults on non-numeric or non-positive input", () => {
    const t = resolveServerTimeouts({
      KEEPALIVE_TIMEOUT_MS: "not-a-number",
      HEADERS_TIMEOUT_MS: "-5",
    });
    assert.ok(t.keepAliveTimeoutMs > 0);
    assert.ok(t.headersTimeoutMs > t.keepAliveTimeoutMs);
    assert.equal(t.errors.length, 0);
  });
});
