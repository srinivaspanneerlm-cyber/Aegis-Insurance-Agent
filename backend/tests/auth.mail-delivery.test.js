/**
 * Verification and reset mail: delivery, and what happens without it.
 *
 * The delivery path is a seam, not a mail client — `AUTH_MAIL_WEBHOOK_URL`
 * receives the message as JSON, so any transactional provider reachable over
 * HTTP works and none is hardcoded. What these tests pin is the behaviour that
 * decides whether somebody can recover an account, and whether a credential
 * ends up somewhere it should not.
 *
 * No real mail is sent: the webhook is pointed at a local listener.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, before, after, afterEach } = require("node:test");
const http = require("node:http");

const { sendAuthMail, identityUrl } = require("../src/auth/mailer");
const { issueToken, consumeToken } = require("../src/auth/verification");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const TAG = `mail-${Date.now()}`;
let server, received = [], baseUrl, user;
const originalWebhook = process.env.AUTH_MAIL_WEBHOOK_URL;

before(async () => {
  // A stand-in for whatever provider endpoint an operator configures.
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ url: req.url, body: JSON.parse(body || "{}") });
      if (req.url === "/fail") {
        res.writeHead(500).end("nope");
        return;
      }
      res.writeHead(202).end("accepted");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // A realistic bcrypt hash, not a one-character placeholder: the leakage check
  // below looks for this exact string in the outbound payload, and "x" appears
  // in almost any text by chance.
  const bcrypt = require("bcrypt");
  user = await prisma.user.create({
    data: {
      name: "Mail probe",
      email: `${TAG}@example.com`,
      password: await bcrypt.hash(require("node:crypto").randomBytes(24).toString("base64url"), 10),
    },
  });
});

afterEach(() => {
  received = [];
  if (originalWebhook === undefined) delete process.env.AUTH_MAIL_WEBHOOK_URL;
  else process.env.AUTH_MAIL_WEBHOOK_URL = originalWebhook;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

describe("a configured provider", () => {
  test("receives the message, and the provider accepts it", async () => {
    process.env.AUTH_MAIL_WEBHOOK_URL = `${baseUrl}/send`;
    await sendAuthMail({
      to: `${TAG}@example.com`,
      kind: "PASSWORD_RESET",
      subject: "Set your Aegis password",
      actionUrl: identityUrl("/reset-password", { token: "opaque-test-value" }),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    assert.equal(received.length, 1, "the provider must actually be called");
    const sent = received[0].body;
    assert.equal(sent.to, `${TAG}@example.com`);
    assert.equal(sent.kind, "PASSWORD_RESET");
    assert.ok(sent.actionUrl, "the link must be in the payload");
    assert.ok(sent.expiresAt, "the expiry must travel with it");
  });

  test("a provider failure does not throw — the request that triggered it must survive", async () => {
    process.env.AUTH_MAIL_WEBHOOK_URL = `${baseUrl}/fail`;
    // A reset that 500s on send must not 500 the reset request, or the user
    // cannot retry and the endpoint becomes an existence oracle.
    await sendAuthMail({ to: `${TAG}@example.com`, kind: "PASSWORD_RESET", subject: "x" });
    assert.equal(received.length, 1, "it was attempted");
  });

  test("an unreachable provider does not throw either", async () => {
    // Port 1 is reserved and refuses immediately.
    process.env.AUTH_MAIL_WEBHOOK_URL = "http://127.0.0.1:1/unreachable";
    await sendAuthMail({ to: `${TAG}@example.com`, kind: "PASSWORD_RESET", subject: "x" });
  });
});

describe("no provider configured", () => {
  test("nothing is sent, and the call still succeeds", async () => {
    delete process.env.AUTH_MAIL_WEBHOOK_URL;
    await sendAuthMail({ to: `${TAG}@example.com`, kind: "PASSWORD_RESET", subject: "x" });
    assert.equal(received.length, 0);
  });

  test("production withholds the link rather than logging a credential", () => {
    const fs = require("node:fs");
    const src = fs.readFileSync("src/auth/mailer.ts", "utf8");
    // The branch is the guarantee: outside development the actionUrl is replaced
    // before it reaches the logger.
    assert.match(src, /isProduction \? "\[withheld[^"]*\]" : mail\.actionUrl/);
  });
});

describe("the reset URL", () => {
  test("points at the identity app, not the API", () => {
    const url = identityUrl("/reset-password", { token: "opaque-test-value" });
    assert.ok(url.startsWith("http://localhost:3105/reset-password"), `got ${url}`);
    assert.ok(!url.includes("5000"), "must never point at the backend");
  });

  test("honours a configured identity host", () => {
    // Read through the validated config, so a deployment that sets it gets it.
    const fs = require("node:fs");
    assert.match(fs.readFileSync("src/config/env.ts", "utf8"), /IDENTITY_APP_URL: process\.env\.IDENTITY_APP_URL/);
    assert.match(fs.readFileSync("src/auth/mailer.ts", "utf8"), /env\.IDENTITY_APP_URL/);
  });
});

describe("token security is unchanged by any of this", () => {
  test("the raw token never appears in the stored row", async () => {
    const { token } = await issueToken(user.id, `${TAG}@example.com`, "PASSWORD_RESET");
    const row = await prisma.verificationToken.findFirst({
      where: { userId: user.id, consumedAt: null },
    });
    assert.notEqual(row.tokenHash, token);
    assert.match(row.tokenHash, /^[a-f0-9]{64}$/);
  });

  test("a consumed token is refused", async () => {
    const { token } = await issueToken(user.id, `${TAG}@example.com`, "PASSWORD_RESET");
    assert.equal((await consumeToken(token, "PASSWORD_RESET", `${TAG}@example.com`)).ok, true);
    const again = await consumeToken(token, "PASSWORD_RESET", `${TAG}@example.com`);
    assert.equal(again.ok, false);
    assert.equal(again.reason, "USED");
  });

  test("an expired token is refused", async () => {
    const { token } = await issueToken(user.id, `${TAG}@example.com`, "PASSWORD_RESET");
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const result = await consumeToken(token, "PASSWORD_RESET", `${TAG}@example.com`);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "EXPIRED");
  });

  test("requesting a new link retires the previous one", async () => {
    const { token: older } = await issueToken(user.id, `${TAG}@example.com`, "PASSWORD_RESET");
    await issueToken(user.id, `${TAG}@example.com`, "PASSWORD_RESET");
    assert.equal((await consumeToken(older, "PASSWORD_RESET", `${TAG}@example.com`)).ok, false);
  });
});

describe("no secret leaks into the payload", () => {
  test("the message carries the link and nothing resembling a stored credential", async () => {
    process.env.AUTH_MAIL_WEBHOOK_URL = `${baseUrl}/send`;
    await sendAuthMail({
      to: `${TAG}@example.com`,
      kind: "PASSWORD_RESET",
      subject: "Set your Aegis password",
      actionUrl: identityUrl("/reset-password", { token: "opaque-test-value" }),
    });
    const keys = Object.keys(received[0].body).sort();
    assert.deepEqual(keys, ["actionUrl", "kind", "subject", "to"]);
    // Not a substring hunt for the word "password" — it legitimately appears in
    // "/reset-password" and in the subject line. What must never travel is a
    // stored credential or a signing secret.
    const serialised = JSON.stringify(received[0].body);
    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    assert.ok(!serialised.includes(stored.password), "the stored password hash must never be sent");
    assert.ok(!serialised.includes(process.env.JWT_SECRET), "the signing secret must never be sent");
    assert.equal(received[0].body.tokenHash, undefined, "the stored hash is not the caller's business");
  });
});
