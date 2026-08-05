/**
 * Upload endpoint, end-to-end: real Express app + multer + scan + Prisma,
 * driven through supertest against an ephemeral SQLite database.
 *
 * This is the suite that proves a customer can actually send a photo — the
 * frontend has offered images, video and multi-file since the chat wiring, but
 * until these pass, none of it lands.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
// Small caps so the limit paths are exercised without moving 50 MB around.
process.env.UPLOAD_MAX_BYTES = "2048";
process.env.UPLOAD_MAX_FILES = "3";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-upload-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");

// A real browser states where it came from, and the CSRF guard requires that on
// any state-changing request carrying a session cookie. These agents hold
// cookies, so they have to look like the browser they stand in for.
const BROWSER_ORIGIN = "http://localhost:3000";

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const iso = (brand) => Buffer.from([0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii(brand), 0, 0, 0, 0]);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
const PDF = Buffer.from([...ascii("%PDF-1.4"), 0x0a, 9, 9, 9, 9, 9, 9, 9]);
const HEIC = iso("heic");
const MP4 = iso("isom");
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

/** Vary the bytes so content-hash duplicate detection does not fire. */
const unique = (buf) => Buffer.concat([buf, Buffer.from(String(Math.random()))]);

const written = [];
const remember = (body) => {
  for (const doc of body?.data?.documents ?? []) written.push(doc.filepath);
  return body;
};

after(() => {
  for (const f of written) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  for (const f of [dbFile, `${dbFile}-journal`]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
});

const signIn = async () => {
  const agent = request.agent(app).set("Origin", BROWSER_ORIGIN);
  const email = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const reg = await agent.post("/api/v1/auth/register").send({
    name: "Uploader",
    email,
    password: "verylongpassword123",
  });
  assert.equal(reg.status, 201);
  return agent;
};

describe("POST /api/v1/upload — access", () => {
  test("refuses an unauthenticated upload", async () => {
    const res = await request(app).post("/api/v1/upload").attach("file", unique(PDF), "policy.pdf");
    assert.equal(res.status, 401);
  });

  test("rejects a request with no file at all", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload");
    assert.equal(res.status, 400);
  });
});

describe("POST /api/v1/upload — the formats a customer actually has", () => {
  test("accepts a phone photo (PNG)", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(PNG), "rc-book.png");

    assert.equal(res.status, 201);
    remember(res.body);
    assert.equal(res.body.data.document.filename, "rc-book.png");
  });

  test("accepts an iPhone HEIC", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(HEIC), "aadhaar.heic");

    assert.equal(res.status, 201);
    remember(res.body);
  });

  test("accepts a motor walkaround video", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(MP4), "walkaround.mp4");

    assert.equal(res.status, 201);
    remember(res.body);
  });

  test("keeps the original single-file response shape", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(PDF), "policy.pdf");

    assert.equal(res.status, 201);
    remember(res.body);
    assert.ok(res.body.data.document.id, "`document` is still the single-file contract");
  });
});

describe("POST /api/v1/upload — what it turns away", () => {
  test("rejects an executable disguised as a PDF", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(EXE), "invoice.pdf");

    assert.equal(res.status, 400);
    assert.match(res.body.message, /security scan/i);
  });

  test("rejects a genuine video wearing a PDF extension", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(MP4), "invoice.pdf");

    assert.equal(res.status, 400);
  });

  test("rejects a file type that is not on the list at all", async () => {
    const agent = await signIn();
    const res = await agent.post("/api/v1/upload").attach("file", unique(EXE), "setup.exe");

    assert.equal(res.status, 400);
    assert.match(res.body.message, /not a file type/i);
  });

  test("explains an oversized file instead of failing with a 500", async () => {
    const agent = await signIn();
    const big = Buffer.concat([PNG, Buffer.alloc(4096, 7)]); // over the 2 KB test cap
    const res = await agent.post("/api/v1/upload").attach("file", big, "huge.png");

    assert.equal(res.status, 400, "an ordinary oversize file is not a server error");
    assert.match(res.body.message, /too large/i);
    assert.match(res.body.message, /KB|MB/, "the message names the actual limit");
  });

  test("turns away the same document twice", async () => {
    const agent = await signIn();
    const bytes = unique(PDF);

    const first = await agent.post("/api/v1/upload").attach("file", bytes, "policy.pdf");
    assert.equal(first.status, 201);
    remember(first.body);

    const again = await agent.post("/api/v1/upload").attach("file", bytes, "policy.pdf");
    assert.equal(again.status, 409);
  });
});

describe("POST /api/v1/upload — several documents at once", () => {
  test("accepts a batch and reports every one of them", async () => {
    const agent = await signIn();
    const res = await agent
      .post("/api/v1/upload")
      .attach("files", unique(PNG), "rc.png")
      .attach("files", unique(PDF), "policy.pdf");

    assert.equal(res.status, 201);
    remember(res.body);
    assert.equal(res.body.data.documents.length, 2);
    assert.deepEqual(res.body.data.rejected, []);
  });

  test("keeps the good files when one in the batch is bad", async () => {
    const agent = await signIn();
    const res = await agent
      .post("/api/v1/upload")
      .attach("files", unique(PNG), "rc.png")
      .attach("files", unique(EXE), "evil.pdf");

    assert.equal(res.status, 201, "one bad file must not discard the good one");
    remember(res.body);
    assert.equal(res.body.data.documents.length, 1);
    assert.equal(res.body.data.rejected.length, 1);
    assert.equal(res.body.data.rejected[0].filename, "evil.pdf");
  });

  test("fails the request when nothing in the batch survived", async () => {
    const agent = await signIn();
    const res = await agent
      .post("/api/v1/upload")
      .attach("files", unique(EXE), "a.pdf")
      .attach("files", unique(EXE), "b.pdf");

    assert.equal(res.status, 400);
  });

  test("refuses more files than the limit allows", async () => {
    const agent = await signIn();
    const res = await agent
      .post("/api/v1/upload")
      .attach("files", unique(PNG), "1.png")
      .attach("files", unique(PNG), "2.png")
      .attach("files", unique(PNG), "3.png")
      .attach("files", unique(PNG), "4.png");

    assert.equal(res.status, 400);
    assert.match(res.body.message, /at most 3 files/i);
  });
});
