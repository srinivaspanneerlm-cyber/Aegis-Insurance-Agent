/**
 * Upstream errors must not describe how we are built.
 *
 * CLAUDE.md §8: production errors are generic; details are logged server-side
 * only. The UI action controller relayed the AI engine's error detail straight
 * to the caller — and on a network failure that detail is axios's message,
 * which names the AI service's host and port. The engine itself takes care not
 * to leak its internals; relaying them here undid that.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, mock, beforeEach } = require("node:test");

const axios = require("axios");
const { dispatchUIAction } = require("../src/controllers/ui_action.controller");

const makeReq = () => ({ body: { action: "view_details", session_id: "s-1" } });

function makeResNext() {
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  const errors = [];
  return { res, next: (err) => err && errors.push(err), errors };
}

const run = (req, res, next) => Promise.resolve(dispatchUIAction(req, res, next));

describe("dispatchUIAction error disclosure", () => {
  beforeEach(() => mock.restoreAll());

  test("a network failure does not reveal the AI service address", async () => {
    mock.method(axios, "post", async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8000");
    });
    const { res, next, errors } = makeResNext();

    await run(makeReq(), res, next);

    assert.equal(errors.length, 1);
    const message = errors[0].message;
    assert.doesNotMatch(message, /127\.0\.0\.1|ECONNREFUSED|:8000/, message);
    assert.equal(errors[0].statusCode, 502, "an upstream we own reports as a bad gateway");
  });

  test("the engine's own error detail is not relayed", async () => {
    mock.method(axios, "post", async () => {
      const err = new Error("Request failed");
      err.response = {
        status: 500,
        data: { detail: "Traceback: /srv/aegis/app/services/ui_action.py line 44, provider=ollama" },
      };
      throw err;
    });
    const { res, next, errors } = makeResNext();

    await run(makeReq(), res, next);

    const message = errors[0].message;
    assert.doesNotMatch(message, /Traceback|\/srv\/|ollama|ui_action\.py/, message);
  });

  // A 4xx is the caller's own payload being wrong — worth telling them, via the
  // status. The message still must not describe our internals.
  test("a rejected payload keeps its status without explaining our internals", async () => {
    mock.method(axios, "post", async () => {
      const err = new Error("Request failed");
      err.response = { status: 422, data: { detail: "field 'session_data.plan_id' invalid at app/models/schemas.py:88" } };
      throw err;
    });
    const { res, next, errors } = makeResNext();

    await run(makeReq(), res, next);

    assert.equal(errors[0].statusCode, 422);
    assert.doesNotMatch(errors[0].message, /schemas\.py|app\//, errors[0].message);
  });

  test("a missing action is still rejected before any upstream call", async () => {
    const post = mock.method(axios, "post", async () => ({ data: {} }));
    const { res, next, errors } = makeResNext();

    await run({ body: {} }, res, next);

    assert.equal(errors[0].statusCode, 400);
    assert.equal(post.mock.calls.length, 0, "no paid-path call for an invalid request");
  });
});
