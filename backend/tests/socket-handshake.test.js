/**
 * The socket handshake gate.
 *
 * Task 9.7. A rejected handshake used to leave no trace — indistinguishable
 * from an ordinary disconnect. These pin that every rejection reason (no
 * token, a token for an account that's gone, a token that doesn't verify)
 * both refuses the connection and leaves an audit record behind.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, mock, beforeEach } = require("node:test");
const jwt = require("jsonwebtoken");

const { userRepository } = require("../src/repositories");
const { auditService } = require("../src/services/audit.service");
const { socketAuthMiddleware } = require("../src/sockets");

const fakeSocket = (overrides = {}) => ({
  handshake: { auth: {}, headers: {}, address: "127.0.0.1", ...overrides },
  data: {},
});

const runMiddleware = (socket) =>
  new Promise((resolve) => socketAuthMiddleware(socket, (err) => resolve(err)));

describe("socket handshake authentication", () => {
  beforeEach(() => mock.restoreAll());

  test("no token: refused and audited", async () => {
    const record = mock.method(auditService, "record", () => {});
    const err = await runMiddleware(fakeSocket());

    assert.ok(err instanceof Error);
    assert.equal(record.mock.calls.length, 1);
    assert.equal(record.mock.calls[0].arguments[0].action, "authz.socket.rejected");
    assert.equal(record.mock.calls[0].arguments[0].metadata.reason, "missing_token");
  });

  test("a well-formed token for an account that no longer exists: refused and audited", async () => {
    mock.method(userRepository, "findById", async () => null);
    const record = mock.method(auditService, "record", () => {});

    const token = jwt.sign({ id: "ghost-user" }, process.env.JWT_SECRET);
    const err = await runMiddleware(fakeSocket({ auth: { token } }));

    assert.ok(err instanceof Error);
    assert.equal(record.mock.calls[0].arguments[0].metadata.reason, "account_missing");
  });

  test("a token that does not verify: refused and audited", async () => {
    const record = mock.method(auditService, "record", () => {});

    const err = await runMiddleware(fakeSocket({ auth: { token: "not-a-real-jwt" } }));

    assert.ok(err instanceof Error);
    assert.equal(record.mock.calls[0].arguments[0].metadata.reason, "invalid_or_expired_token");
  });

  test("a valid token: admitted, and nothing is recorded as a rejection", async () => {
    const user = { id: "user-1", name: "Real Subject", role: "CUSTOMER" };
    mock.method(userRepository, "findById", async () => user);
    const record = mock.method(auditService, "record", () => {});

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    const socket = fakeSocket({ auth: { token } });
    const err = await runMiddleware(socket);

    assert.equal(err, undefined);
    assert.deepEqual(socket.data.user, user);
    assert.equal(record.mock.calls.length, 0);
  });
});
