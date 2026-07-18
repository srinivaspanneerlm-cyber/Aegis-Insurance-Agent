/**
 * Tenant isolation — CLAUDE.md §8 calls cross-tenant leakage a critical defect.
 *
 * Every query that returns user data must be scoped by the *authenticated*
 * user's id, never by an identifier the caller supplies. These tests assert the
 * scoping by inspecting the `where` clause each controller hands the
 * repository, so they need no database and cannot be fooled by an empty result
 * set that happens to look correct.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, mock, beforeEach } = require("node:test");

const { chatRepository, documentRepository } = require("../src/repositories");
const { getChatHistory } = require("../src/controllers/chat.controller");
const { getUploadedDocuments } = require("../src/controllers/upload.controller");

const ALICE = { id: "user-alice", role: "customer" };
const MALLORY = { id: "user-mallory", role: "customer" };
const ADMIN = { id: "user-admin", role: "admin" };

function makeReq({ user, query = {} } = {}) {
  return { user, query, headers: {} };
}

/** Captures the JSON body a controller sends, and any error it forwards. */
function makeResNext() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  const errors = [];
  const next = (err) => err && errors.push(err);
  return { res, next, errors };
}

const run = (handler, req, res, next) => Promise.resolve(handler(req, res, next));

// ── Chat history ──────────────────────────────────────────────────────────────

describe("getChatHistory", () => {
  beforeEach(() => mock.restoreAll());

  test("scopes the query to the authenticated user", async () => {
    const findHistory = mock.method(chatRepository, "findHistory", async () => []);
    const { res, next } = makeResNext();

    await run(getChatHistory, makeReq({ user: ALICE }), res, next);

    const [where] = findHistory.mock.calls[0].arguments;
    assert.equal(where.userId, ALICE.id);
  });

  test("a caller cannot read another user's conversation via session_id", async () => {
    /**
     * The IDOR this endpoint exists to prevent: Mallory knows (or guesses)
     * Alice's session id. The userId filter must still be hers, so the
     * session_id narrows her own rows and can never widen them to Alice's.
     */
    const findHistory = mock.method(chatRepository, "findHistory", async () => []);
    const { res, next } = makeResNext();

    await run(
      getChatHistory,
      makeReq({ user: MALLORY, query: { session_id: "alices-private-session" } }),
      res,
      next
    );

    const [where] = findHistory.mock.calls[0].arguments;
    assert.equal(where.userId, MALLORY.id);
    assert.equal(where.sessionId, "alices-private-session");
    assert.ok(!("OR" in where), "session_id must narrow the scope, never widen it");
  });

  test("identity is never taken from the request the caller controls", async () => {
    /**
     * The scoping must read req.user — set by `protect` from a signed token —
     * and nothing else. Anything on req.query or req.body is attacker input.
     *
     * This is the test the others were missing: they only ever sent a benign
     * query, so a controller reading `req.query.user_id || req.user?.id` passed
     * them all while handing Mallory whatever rows she asked for.
     */
    const findHistory = mock.method(chatRepository, "findHistory", async () => []);
    const { res, next } = makeResNext();

    const req = makeReq({
      user: MALLORY,
      query: { user_id: ALICE.id, userId: ALICE.id, id: ALICE.id },
    });
    req.body = { userId: ALICE.id };

    await run(getChatHistory, req, res, next);

    const [where] = findHistory.mock.calls[0].arguments;
    assert.equal(
      where.userId,
      MALLORY.id,
      "scoping must come from the authenticated session, not the request"
    );
  });

  test("an unauthenticated request is refused before any query runs", async () => {
    const findHistory = mock.method(chatRepository, "findHistory", async () => []);
    const { res, next, errors } = makeResNext();

    await run(getChatHistory, makeReq({ user: undefined }), res, next);

    assert.equal(errors[0].statusCode, 401);
    assert.equal(findHistory.mock.calls.length, 0, "must not query on an anonymous request");
  });

  test("the reply carries only what was fetched", async () => {
    const rows = [{ id: "c1", message: "hi" }];
    mock.method(chatRepository, "findHistory", async () => rows);
    const { res } = makeResNext();

    await run(getChatHistory, makeReq({ user: ALICE }), res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.results, 1);
    assert.deepEqual(res.body.data.chat, rows);
  });

  test("the read is bounded — no unbounded query", async () => {
    /** CLAUDE.md §9: never make an unbounded DB query. */
    const findHistory = mock.method(chatRepository, "findHistory", async () => []);

    await run(getChatHistory, makeReq({ user: ALICE }), makeResNext().res, () => {});

    const [, take] = findHistory.mock.calls[0].arguments;
    assert.equal(typeof take, "number");
    assert.ok(take > 0 && take <= 200, `take should be a sane bound, got ${take}`);
  });
});

// ── Uploaded documents ────────────────────────────────────────────────────────

describe("getUploadedDocuments", () => {
  beforeEach(() => mock.restoreAll());

  // The read is a single paginated query; the tenant scope lives in its `where`
  // clause. A customer's `where` must be pinned to their own id, an admin's must
  // be unscoped, and the page size is always bounded (CLAUDE.md §8 + §9).
  const emptyPage = async () => ({ items: [], total: 0, page: 1, limit: 100, pages: 0 });

  test("a customer's read is scoped to their own id", async () => {
    const paginate = mock.method(documentRepository, "paginate", emptyPage);
    const { res } = makeResNext();

    await run(getUploadedDocuments, makeReq({ user: ALICE }), res, () => {});

    const [where] = paginate.mock.calls[0].arguments;
    assert.equal(where.ownerId, ALICE.id);
  });

  test("a customer cannot reach another customer's documents", async () => {
    const paginate = mock.method(documentRepository, "paginate", emptyPage);
    const { res } = makeResNext();

    await run(getUploadedDocuments, makeReq({ user: MALLORY }), res, () => {});

    const [where] = paginate.mock.calls[0].arguments;
    assert.equal(where.ownerId, MALLORY.id);
    assert.notEqual(where.ownerId, ALICE.id);
  });

  test("an admin's read is unscoped — sees everything", async () => {
    const paginate = mock.method(documentRepository, "paginate", emptyPage);
    const { res } = makeResNext();

    await run(getUploadedDocuments, makeReq({ user: ADMIN }), res, () => {});

    const [where] = paginate.mock.calls[0].arguments;
    assert.ok(!("ownerId" in where), "an admin read must not be owner-scoped");
  });

  test("only admin and superadmin get the unscoped read", async () => {
    for (const role of ["admin", "superadmin"]) {
      mock.restoreAll();
      const paginate = mock.method(documentRepository, "paginate", emptyPage);

      await run(
        getUploadedDocuments,
        makeReq({ user: { id: "u", role } }),
        makeResNext().res,
        () => {}
      );
      const [where] = paginate.mock.calls[0].arguments;
      assert.ok(!("ownerId" in where), `${role} should see all`);
    }
  });

  test("an unrecognised role is treated as a customer, not an admin", async () => {
    /**
     * Fail closed: a role that is not explicitly admin/superadmin — a typo, a
     * new role added later, a value copied from a token — gets the scoped read.
     */
    const paginate = mock.method(documentRepository, "paginate", emptyPage);

    await run(
      getUploadedDocuments,
      makeReq({ user: { id: "u-x", role: "Admin" } }), // capitalised — not a match
      makeResNext().res,
      () => {}
    );

    const [where] = paginate.mock.calls[0].arguments;
    assert.equal(where.ownerId, "u-x", "role matching must be exact; fail closed to a scoped read");
  });
});
