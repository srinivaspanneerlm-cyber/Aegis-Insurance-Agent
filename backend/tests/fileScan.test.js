/**
 * Upload content scan (PR-3).
 *
 * The multer filter trusts the client-declared MIME, so scanFile is the real
 * content check: it must accept genuine PDF/DOCX magic bytes and reject a
 * disguised file (e.g. a renamed executable) as well as an unreadable path.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe, before, after } = require("node:test");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const { scanFile, isAllowedFileContent } = require("../src/utils/fileScan");

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]); // PK\x03\x04…
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ… (PE)

describe("isAllowedFileContent", () => {
  test("accepts PDF magic bytes", () => {
    assert.equal(isAllowedFileContent(PDF), true);
  });
  test("accepts DOCX/OOXML zip magic bytes", () => {
    assert.equal(isAllowedFileContent(DOCX), true);
  });
  test("rejects a Windows executable header", () => {
    assert.equal(isAllowedFileContent(EXE), false);
  });
  test("rejects arbitrary/empty content", () => {
    assert.equal(isAllowedFileContent(Buffer.from("hello")), false);
    assert.equal(isAllowedFileContent(Buffer.alloc(0)), false);
  });
});

describe("scanFile", () => {
  let dir;
  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "aegis-scan-"));
  });
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const writeTmp = async (name, buf) => {
    const p = path.join(dir, name);
    await fs.writeFile(p, buf);
    return p;
  };

  test("passes a genuine PDF", async () => {
    const scan = await scanFile(await writeTmp("real.pdf", PDF));
    assert.equal(scan.clean, true);
  });

  test("passes a genuine DOCX", async () => {
    const scan = await scanFile(await writeTmp("real.docx", DOCX));
    assert.equal(scan.clean, true);
  });

  test("rejects an executable disguised as .pdf", async () => {
    const scan = await scanFile(await writeTmp("evil.pdf", EXE));
    assert.equal(scan.clean, false);
    assert.match(scan.reason, /content/);
  });

  test("fails closed on an unreadable path", async () => {
    const scan = await scanFile(path.join(dir, "does-not-exist.pdf"));
    assert.equal(scan.clean, false);
    assert.match(scan.reason, /read/);
  });
});
