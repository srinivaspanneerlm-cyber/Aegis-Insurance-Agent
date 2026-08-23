/**
 * Structured logger redaction — `src/config/logger.ts`'s belt-and-suspenders
 * strip for anything secret-bearing.
 *
 * Found during production-hardening: this config existed and was correct,
 * but nothing guarded it — a future edit could silently narrow the redact
 * paths (or drop `remove: true`) and no test would notice. Built against a
 * fresh pino instance using the exact same exported options, writing to an
 * in-memory stream, rather than trying to intercept the real logger's
 * stdout.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { Writable } = require("node:stream");
const pino = require("pino");

const { loggerOptions } = require("../src/config/logger");

/** A pino instance built from the real config, writing to a capturable buffer. */
function captureLogger() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString("utf8"));
      cb();
    },
  });
  const logger = pino(loggerOptions, stream);
  return { logger, lines: () => lines.map((l) => JSON.parse(l)) };
}

describe("logger redaction", () => {
  test("strips a top-level password", () => {
    const { logger, lines } = captureLogger();
    logger.info({ password: "hunter2", email: "a@b.com" }, "auth attempt");
    const [entry] = lines();
    assert.equal(entry.password, undefined);
    assert.equal(entry.email, "a@b.com");
  });

  test("strips a nested password one level down", () => {
    const { logger, lines } = captureLogger();
    logger.info({ user: { password: "hunter2", name: "Test" } }, "registered");
    const [entry] = lines();
    assert.equal(entry.user.password, undefined);
    assert.equal(entry.user.name, "Test");
  });

  test("strips a top-level and nested token", () => {
    const { logger, lines } = captureLogger();
    logger.info({ token: "abc.def.ghi", session: { token: "xyz" } }, "issued");
    const [entry] = lines();
    assert.equal(entry.token, undefined);
    assert.equal(entry.session.token, undefined);
  });

  test("strips an Authorization header and a Cookie header if ever logged", () => {
    const { logger, lines } = captureLogger();
    logger.info(
      { req: { headers: { authorization: "Bearer secret", cookie: "aegis_session=abc" } } },
      "request"
    );
    const [entry] = lines();
    assert.equal(entry.req.headers.authorization, undefined);
    assert.equal(entry.req.headers.cookie, undefined);
  });

  test("strips a Set-Cookie response header if ever logged", () => {
    const { logger, lines } = captureLogger();
    logger.info({ res: { headers: { "set-cookie": "aegis_session=abc; HttpOnly" } } }, "response");
    const [entry] = lines();
    assert.equal(entry.res.headers["set-cookie"], undefined);
  });

  test("does not touch fields that are not on the redact list", () => {
    // A regression that widened redaction (e.g. redacting "message" or
    // "requestId") would be just as real a bug as one that narrowed it.
    const { logger, lines } = captureLogger();
    logger.info({ requestId: "req-1", statusCode: 503, code: "VOICE_UNAVAILABLE" }, "voice failed");
    const [entry] = lines();
    assert.equal(entry.requestId, "req-1");
    assert.equal(entry.statusCode, 503);
    assert.equal(entry.code, "VOICE_UNAVAILABLE");
  });
});
