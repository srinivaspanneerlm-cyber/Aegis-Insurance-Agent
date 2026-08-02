/**
 * Upload content scan (PR-3, extended in the document-intelligence phase).
 *
 * The multer filter trusts the client-declared MIME, so scanFile is the real
 * content check. It must accept every format Aegis now permits — paperwork,
 * phone photos and claim videos — and reject both a disguised file (a renamed
 * executable) and a genuine file wearing the wrong extension.
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
const {
  detectFormat,
  extensionOf,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIMES,
} = require("../src/utils/fileTypes");
const { UPLOADS } = require("../src/config/constants");

describe("upload limits", () => {
  test("defaults leave room for a phone photo or a short video", () => {
    assert.equal(UPLOADS.MAX_BYTES, 50 * 1024 * 1024);
    assert.ok(UPLOADS.MAX_FILES > 1, "an agent asks for more than one document at a time");
  });
});

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
/** An ISO base-media header: 4 size bytes, "ftyp", then the brand. */
const iso = (brand) => Buffer.from([0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii(brand), 0, 0, 0, 0]);

const SAMPLES = {
  pdf: Buffer.from([...ascii("%PDF-1.4"), 0x0a, 0, 0, 0, 0, 0, 0, 0]),
  docx: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii("JFIF"), 0, 0, 0, 0, 0, 0]),
  webp: Buffer.from([...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBP"), 0, 0, 0, 0]),
  heic: iso("heic"),
  mp4: iso("isom"),
  mov: iso("qt  "),
};

const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ… (PE)

describe("fileTypes catalogue", () => {
  test("covers the formats the advisor offers", () => {
    for (const ext of [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".heic", ".webp", ".mp4", ".mov"]) {
      assert.ok(ALLOWED_EXTENSIONS.includes(ext), `${ext} should be permitted`);
    }
  });

  test("tolerates the vague MIME types browsers send for DOCX and HEIC", () => {
    assert.ok(ALLOWED_MIMES.has("application/octet-stream"));
    assert.ok(ALLOWED_MIMES.has(""));
  });

  test("does not permit a type nobody asked for", () => {
    assert.ok(!ALLOWED_EXTENSIONS.includes(".exe"));
    assert.ok(!ALLOWED_MIMES.has("application/x-msdownload"));
  });

  test("reads an extension case-insensitively", () => {
    assert.equal(extensionOf("SCAN.PDF"), ".pdf");
    assert.equal(extensionOf("no-extension"), "");
  });

  test("identifies each format from its bytes alone", () => {
    for (const [id, buf] of Object.entries(SAMPLES)) {
      assert.equal(detectFormat(buf)?.id, id, `${id} should be detected`);
    }
  });

  test("tells MP4, MOV and HEIC apart despite their shared container", () => {
    assert.equal(detectFormat(iso("isom")).id, "mp4");
    assert.equal(detectFormat(iso("qt  ")).id, "mov");
    assert.equal(detectFormat(iso("heic")).id, "heic");
    // An ISO container with a brand we do not accept is not smuggled through.
    assert.equal(detectFormat(iso("weir")), null);
  });
});

describe("isAllowedFileContent", () => {
  test("accepts every permitted format", () => {
    for (const [id, buf] of Object.entries(SAMPLES)) {
      assert.equal(isAllowedFileContent(buf), true, `${id} should be allowed`);
    }
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

  test("passes a genuine file of every permitted format", async () => {
    const names = {
      pdf: "policy.pdf",
      docx: "form.docx",
      png: "rc.png",
      jpeg: "aadhaar.jpg",
      webp: "bill.webp",
      heic: "photo.heic",
      mp4: "walkaround.mp4",
      mov: "damage.mov",
    };
    for (const [id, buf] of Object.entries(SAMPLES)) {
      const scan = await scanFile(await writeTmp(names[id], buf), names[id]);
      assert.equal(scan.clean, true, `${id} should pass`);
      assert.equal(scan.format, id);
    }
  });

  test("rejects an executable disguised as .pdf", async () => {
    const scan = await scanFile(await writeTmp("evil.pdf", EXE), "evil.pdf");
    assert.equal(scan.clean, false);
    assert.match(scan.reason, /content/);
  });

  test("rejects a genuine file wearing the wrong extension", async () => {
    // A real MP4 called invoice.pdf: permitted content, dishonest name.
    const scan = await scanFile(await writeTmp("invoice.pdf", SAMPLES.mp4), "invoice.pdf");
    assert.equal(scan.clean, false);
    assert.equal(scan.format, "mp4");
    assert.match(scan.reason, /does not match its name/);
  });

  test("accepts either extension a format legitimately uses", async () => {
    const jpeg = await scanFile(await writeTmp("scan.jpeg", SAMPLES.jpeg), "scan.jpeg");
    assert.equal(jpeg.clean, true);
    const heif = await scanFile(await writeTmp("photo.heif", SAMPLES.heic), "photo.heif");
    assert.equal(heif.clean, true);
  });

  test("judges the customer's filename, not multer's generated one", async () => {
    // Stored as file-123.pdf on disk; the customer called it evil.exe.
    const stored = await writeTmp("file-123456789.pdf", SAMPLES.pdf);
    assert.equal((await scanFile(stored, "evil.exe")).clean, false);
    assert.equal((await scanFile(stored, "policy.pdf")).clean, true);
  });

  test("fails closed on an unreadable path", async () => {
    const scan = await scanFile(path.join(dir, "does-not-exist.pdf"));
    assert.equal(scan.clean, false);
    assert.match(scan.reason, /read/);
  });
});
