/**
 * The AI-backed socket message throttle.
 *
 * Task 9.6. The counter used to live on the connection: a fresh socket meant a
 * fresh allowance, so a client could reset it for free by disconnecting and
 * reconnecting — the handshake costs only a JWT it already holds. These pin
 * that the allowance now belongs to the authenticated identity, and survives
 * exactly what it is supposed to survive.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, mock, beforeEach } = require("node:test");

const { chatRepository } = require("../src/repositories");
const aiService = require("../src/services/ai.service");
const { initSockets } = require("../src/sockets");
const { auditService } = require("../src/services/audit.service");

let seq = 0;
const uniqueUser = (tag) => ({ id: `user-${tag}-${Date.now()}-${seq++}`, name: "Subject", role: "customer" });

/** A socket whose emitted events are recorded for inspection. */
function makeSocket(user) {
  const handlers = {};
  const emitted = [];
  return {
    id: `sock-${user.id}`,
    data: { user },
    handlers,
    emitted,
    on: (event, fn) => { handlers[event] = fn; },
    emit: (event, payload) => emitted.push({ event, payload }),
    join: () => {},
  };
}

function makeIo() {
  let onConnection = null;
  return {
    on: (event, fn) => { if (event === "connection") onConnection = fn; },
    to: () => {},
    connect(socket) { onConnection(socket); return socket; },
  };
}

/** A fresh io instance and a socket connected against it for the given user. */
const connectAs = (user) => {
  const io = makeIo();
  initSockets(io);
  return io.connect(makeSocket(user));
};

const errorEvents = (socket) => socket.emitted.filter((e) => e.event === "error");

describe("socket message rate limit", () => {
  beforeEach(() => mock.restoreAll());

  const send = async (socket, n = 1) => {
    mock.method(chatRepository, "create", async (row) => ({ id: "msg", ...row }));
    mock.method(aiService, "getResponseFromAIService", async () => "reply");
    for (let i = 0; i < n; i++) {
      await socket.handlers.send_message({ message: `msg ${i}`, sender: "customer" });
    }
  };

  test("twenty messages in a minute go through untouched", async () => {
    const socket = connectAs(uniqueUser("under-limit"));
    await send(socket, 20);
    assert.equal(errorEvents(socket).length, 0);
  });

  test("the twenty-first message in the same minute is refused", async () => {
    const socket = connectAs(uniqueUser("over-limit"));
    await send(socket, 21);
    const errors = errorEvents(socket);
    assert.equal(errors.length, 1);
    assert.match(errors[0].payload.message, /rate limit/i);
  });

  test("reconnecting does not reset the allowance", async () => {
    // This is the bug: the same account, one new socket. Before the fix, a
    // fresh connection meant a fresh in-memory counter and the limit reset
    // for free — defeating the cost-abuse protection this exists for.
    const user = uniqueUser("reconnect");

    const first = connectAs(user);
    await send(first, 20);
    assert.equal(errorEvents(first).length, 0, "the first connection used its whole allowance");

    const second = connectAs(user);
    await send(second, 1);
    assert.equal(errorEvents(second).length, 1, "the same identity is still throttled on a new socket");
  });

  test("a different account is unaffected by another account's limit", async () => {
    const exhausted = uniqueUser("busy-neighbour");
    const busy = connectAs(exhausted);
    await send(busy, 20);
    assert.equal(errorEvents(busy).length, 0);

    const other = connectAs(uniqueUser("quiet-neighbour"));
    await send(other, 1);
    assert.equal(errorEvents(other).length, 0, "a different identity has its own allowance");
  });

  test("being throttled leaves an audit record, not just a dropped message", async () => {
    // Task 9.7. A sustained burst against this throttle used to be invisible
    // to the audit trail — the client got an error event and nothing else.
    const record = mock.method(auditService, "record", () => {});
    const user = uniqueUser("audited");
    const socket = connectAs(user);

    await send(socket, 21);

    const calls = record.mock.calls.filter((c) => c.arguments[0].action === "security.rate_limit.socket");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arguments[0].actorId, user.id);
  });
});
