/**
 * Socket broadcast targets — a client must never name who receives a message.
 *
 * `join_room` used to put a socket in any room it asked for, and every reply
 * was broadcast to the room the sender named. Nothing checked the room was
 * theirs, so a caller could sit in the path of another customer's conversation.
 *
 * These tests hold that surface closed. `socket.to` and `io.to` are still
 * booby-trapped — nothing in the connection path may target a room by name.
 *
 * `socket.join` is now reachable, and the assertion on it is *tighter* than the
 * old "never called": it must be called with exactly the room derived from the
 * handshake identity and nothing else. That is what lets a notification reach
 * one person's open portal while keeping the original property — a client
 * cannot name a room, because the only room that exists is computed from the
 * authenticated user id on the server.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, mock, beforeEach } = require("node:test");

const { chatRepository } = require("../src/repositories");
const aiService = require("../src/services/ai.service");
const { initSockets } = require("../src/sockets");

const ALICE = { id: "user-alice", name: "Alice", role: "customer" };

/** A socket whose room-targeting calls are booby-trapped. */
function makeSocket(user = ALICE) {
  const handlers = {};
  const emitted = [];
  return {
    id: "sock-alice",
    data: { user },
    handlers,
    emitted,
    on: (event, fn) => { handlers[event] = fn; },
    emit: (event, payload) => emitted.push({ event, payload }),
    joined: [],
    join: function (room) {
      // The one room a socket may occupy: its own, derived server-side.
      assert.equal(
        room,
        `user:${user.id}`,
        "a socket may only join the room derived from its handshake identity"
      );
      this.joined.push(room);
    },
    to: () => assert.fail("socket.to must not be reachable — rooms are client-named"),
  };
}

function makeIo() {
  let onConnection = null;
  return {
    on: (event, fn) => { if (event === "connection") onConnection = fn; },
    to: () => assert.fail("io.to must not be reachable — rooms are client-named"),
    connect(socket) { onConnection(socket); return socket; },
  };
}

const connectedSocket = () => {
  const io = makeIo();
  initSockets(io);
  return io.connect(makeSocket());
};

describe("socket rooms", () => {
  beforeEach(() => mock.restoreAll());

  test("there is no join_room handler to abuse", () => {
    // The client still has no way to ask for a room.
    assert.equal(connectedSocket().handlers.join_room, undefined);
  });

  test("a socket joins exactly one room, and it is its own", () => {
    const socket = connectedSocket();
    // The assertion inside the fake `join` has already rejected any other room.
    assert.deepEqual(socket.joined, [`user:${ALICE.id}`]);
  });

  test("no handler broadcasts to a room the client named", async () => {
    mock.method(chatRepository, "create", async (row) => ({ id: "msg-1", ...row }));
    mock.method(aiService, "getResponseFromAIService", async () => "Hello from Sarah.");

    const socket = connectedSocket();
    // A caller still sends roomId — it must simply have nowhere to go. Any
    // io.to / socket.to / socket.join reached here fails the test.
    await socket.handlers.send_message({
      roomId: "some-other-customers-room",
      message: "what does my policy cover?",
      sender: "customer",
    });

    const received = socket.emitted.filter((e) => e.event === "message_received");
    assert.equal(received.length, 2, "the customer gets their own message and the reply");
  });

  test("the reply goes back to the sender, not anywhere they chose", async () => {
    mock.method(chatRepository, "create", async (row) => ({ id: "msg-1", ...row }));
    mock.method(aiService, "getResponseFromAIService", async () => "Hello from Sarah.");

    const socket = connectedSocket();
    await socket.handlers.send_message({ message: "hi", sender: "customer" });

    const events = socket.emitted.map((e) => e.event);
    assert.deepEqual(events, [
      "message_received", // the customer's own message
      "typing_state",     // advisor is thinking
      "typing_state",     // done
      "message_received", // the advisor's reply
    ]);
  });

  // The handshake identity is the whole point — a spoofed sender must not be
  // able to write rows as, or pull history for, anyone else.
  test("rows are written against the handshake identity, not the payload", async () => {
    const create = mock.method(chatRepository, "create", async (row) => ({ id: "msg-1", ...row }));
    mock.method(aiService, "getResponseFromAIService", async () => "reply");

    const socket = connectedSocket();
    await socket.handlers.send_message({ message: "hi", sender: "customer", userId: "user-mallory" });

    assert.equal(create.mock.calls[0].arguments[0].userId, ALICE.id);
  });

  test("the AI call is scoped to the handshake identity", async () => {
    mock.method(chatRepository, "create", async (row) => ({ id: "msg-1", ...row }));
    const ai = mock.method(aiService, "getResponseFromAIService", async () => "reply");

    const socket = connectedSocket();
    await socket.handlers.send_message({ message: "hi", sender: "customer" });

    const args = ai.mock.calls[0].arguments;
    assert.equal(args[1], ALICE.name, "user name comes from the handshake");
    assert.equal(args[4], ALICE.id, "history is scoped to the authenticated user");
  });
});
