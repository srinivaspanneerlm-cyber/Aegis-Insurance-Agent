/**
 * The mail relay.
 *
 * This service is the far end of the platform's delivery seam: the backend
 * POSTs a message here and this sends it. The properties worth pinning are the
 * ones that decide whether the relay can be turned against its owner — an open
 * relay that sends from your domain is a phishing service with your return
 * address on it — and whether a single-use credential ends up in a log.
 *
 * No real email is sent: Resend is never called, or is stubbed.
 */

import assert from "node:assert/strict";
import { test, describe, afterEach } from "node:test";
import { parseAuthMail, render, sendViaResend } from "../src/mail";

const base = {
  to: "someone@example.com",
  kind: "PASSWORD_RESET",
  subject: "Set your Aegis password",
  actionUrl: "http://localhost:3105/reset-password?token=opaque-test-value",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const original = { ...process.env };
afterEach(() => {
  for (const k of ["IDENTITY_APP_URL", "RESEND_API_KEY", "MAIL_FROM"]) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("what the relay accepts", () => {
  test("a well-formed reset message", () => {
    const parsed = parseAuthMail(base);
    assert.ok(!("error" in parsed));
    assert.equal(parsed.to, base.to);
  });

  test("refuses a link pointing anywhere but the identity app", () => {
    // The whole point: without this the relay forwards any URL a caller
    // supplies, over our branding.
    const evil = { ...base, actionUrl: "https://evil.example.com/reset-password?token=x" };
    const parsed = parseAuthMail(evil);
    assert.ok("error" in parsed);
    assert.match(parsed.error, /identity app/);
  });

  test("refuses a malformed recipient", () => {
    assert.ok("error" in parseAuthMail({ ...base, to: "not-an-email" }));
  });

  test("refuses an unknown kind", () => {
    assert.ok("error" in parseAuthMail({ ...base, kind: "MARKETING_BLAST" }));
  });

  test("refuses a missing subject", () => {
    assert.ok("error" in parseAuthMail({ ...base, subject: "  " }));
  });

  test("refuses a non-object body", () => {
    assert.ok("error" in parseAuthMail("hello"));
  });

  test("keeps only the fields it knows — extras are dropped", () => {
    const parsed = parseAuthMail({ ...base, bcc: "attacker@example.com", replyTo: "x@y.z" });
    assert.deepEqual(Object.keys(parsed).sort(), [
      "actionUrl",
      "expiresAt",
      "kind",
      "subject",
      "to",
    ]);
  });

  test("honours a configured identity host", () => {
    process.env.IDENTITY_APP_URL = "https://id.aegis.example";
    assert.ok("error" in parseAuthMail(base), "a localhost link is wrong once the host is set");
    const ok = parseAuthMail({
      ...base,
      actionUrl: "https://id.aegis.example/reset-password?token=x",
    });
    assert.ok(!("error" in ok));
  });
});

describe("the message body", () => {
  test("carries the link, the expiry and a way to ignore it", () => {
    const { html, text } = render(base);
    assert.ok(text.includes(base.actionUrl));
    assert.ok(html.includes(base.actionUrl));
    assert.match(text, /only be used once/);
    assert.match(text, /did not ask for this/);
  });

  test("a password-changed notice carries no link at all", () => {
    const { html, text } = render({ to: base.to, kind: "PASSWORD_CHANGED", subject: "Changed" });
    assert.ok(!html.includes("href"));
    assert.match(text, /reset your password immediately/i);
  });
});

describe("sending", () => {
  test("refuses to send when the provider is not configured — and says which part", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    const result = await sendViaResend(parseAuthMail(base));
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.reason, /RESEND_API_KEY/);
  });

  test("an unreachable provider reports a gateway failure rather than throwing", async () => {
    process.env.RESEND_API_KEY = "test-only-not-a-real-key";
    process.env.MAIL_FROM = "Aegis <noreply@example.com>";
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("network down");
    };
    try {
      const result = await sendViaResend(parseAuthMail(base));
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("a provider rejection reports the status and never echoes the provider's body", async () => {
    process.env.RESEND_API_KEY = "test-only-not-a-real-key";
    process.env.MAIL_FROM = "Aegis <noreply@example.com>";
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: `rejected ${base.actionUrl}` }), { status: 422 });
    try {
      const result = await sendViaResend(parseAuthMail(base));
      assert.equal(result.ok, false);
      assert.equal(result.status, 422);
      // The provider can quote the request back; that would put a single-use
      // token into this service's log.
      assert.ok(!result.reason.includes("token="), "a reset link must never travel in an error");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("a success returns the provider's id and sends the key only as a bearer header", async () => {
    process.env.RESEND_API_KEY = "test-only-not-a-real-key";
    process.env.MAIL_FROM = "Aegis <noreply@example.com>";
    const realFetch = globalThis.fetch;
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
    };
    try {
      const result = await sendViaResend(parseAuthMail(base));
      assert.equal(result.ok, true);
      assert.equal(result.id, "msg_123");
      assert.equal(seen.url, "https://api.resend.com/emails");
      assert.equal(seen.init.headers.Authorization, "Bearer test-only-not-a-real-key");
      // The key must never appear in the message itself.
      assert.ok(!seen.init.body.includes("test-only-not-a-real-key"));
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
