/**
 * Attaching a certificate to a policy, driven through the real app.
 *
 * The upload path is where this product touches the two things it cannot get
 * wrong: somebody else's file, and a file that is not what it says it is. So
 * most of this suite is adversarial — disguised bytes, borrowed ids, a second
 * customer reaching for the first one's certificate — and the happy path is
 * only the handful of cases at the top.
 *
 * Everything runs against a real Express app, real multer, the real magic-byte
 * scanner and an ephemeral SQLite database. Nothing is mocked, because every
 * one of those layers is part of the guarantee being asserted.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3000";
// A small cap so the oversize path is exercised without moving 10 MB around.
// The limit being configurable at all is part of what this asserts.
process.env.CONSUMER_DOCUMENT_MAX_BYTES = "4096";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-consumer-doc-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after, before } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");
const { UPLOAD_DIR } = require("../src/config/uploadDir");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";
const API = "/api/v1/consumer";

after(async () => {
  // Take the files this suite wrote with it. The rows name them, so nothing is
  // guessed from the directory — a developer's own uploads are not ours to bin.
  const written = await prisma.uploadedDocument.findMany({ select: { filepath: true } });
  await prisma.$disconnect();
  for (const { filepath } of written) {
    try { fs.unlinkSync(filepath); } catch { /* already gone */ }
  }
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

// ── Bytes ────────────────────────────────────────────────────────────────────

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const iso = (brand) => Buffer.from([0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii(brand), 0, 0, 0, 0]);

const PDF = Buffer.from([...ascii("%PDF-1.4"), 0x0a, ...ascii("consumer certificate")]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii("JFIF"), 0, 1, 2, 3]);
const WEBP = Buffer.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), 1, 2, 3, 4]);
const DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const HEIC = iso("heic");
const MP4 = iso("isom");
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]);

/** Vary the tail so two uploads are different files by content hash. */
const unique = (buf) =>
  Buffer.concat([buf, Buffer.from(`-${Date.now()}-${Math.random()}`)]);

const filesOnDisk = () => (fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0);

// ── Accounts and policies ────────────────────────────────────────────────────

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag) {
  seq += 1;
  const email = `consumer-doc-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Person ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201, `registration failed: ${JSON.stringify(res.body)}`);
  return { cookie: cookieHeader(res), userId: res.body.data.user.id };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  post: (p) => request(app).post(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  patch: (p) => request(app).patch(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
});

/** Send one file at a policy, exactly as the browser's form does. */
const attach = (cookie, policyId, buffer, filename, contentType) =>
  api(cookie)
    .post(`/policies/${policyId}/document`)
    .attach("file", buffer, { filename, contentType });

function dateIn(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let plate = 0;
const policyBody = (over = {}) => {
  plate += 1;
  return {
    insurer: "Bharat General Insurance",
    policyNumber: `POL/2026/${String(plate).padStart(6, "0")}`,
    policyType: "COMPREHENSIVE",
    expiryDate: dateIn(60),
    vehicle: { registrationNumber: `TN 09 AB ${1000 + plate}`, vehicleType: "BIKE" },
    ...over,
  };
};

async function policyFor(cookie, over = {}) {
  const res = await api(cookie).post("/policies").send(policyBody(over));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.policy;
}

// ── The happy path ───────────────────────────────────────────────────────────

describe("attaching a certificate", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("happy")); });

  test("a PDF is accepted and the policy comes back checked", async () => {
    const policy = await policyFor(cookie);
    const res = await attach(cookie, policy.id, unique(PDF), "certificate.pdf", "application/pdf");

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.policy.trust.state, "CONSISTENCY_VERIFIED");
    assert.equal(res.body.data.policy.trust.hasDocument, true);
    assert.equal(res.body.data.policy.trust.checks.documentFormatAccepted, true);
  });

  test("a JPG and a PNG are accepted too", async () => {
    for (const [bytes, name, type] of [
      [JPEG, "photo.jpg", "image/jpeg"],
      [PNG, "photo.png", "image/png"],
    ]) {
      const policy = await policyFor(cookie);
      const res = await attach(cookie, policy.id, unique(bytes), name, type);
      assert.equal(res.status, 201, `${name}: ${JSON.stringify(res.body)}`);
    }
  });

  test("the stored record keeps the customer's own filename and a fingerprint", async () => {
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, unique(PDF), "My Policy 2026.pdf", "application/pdf");

    const list = await api(cookie).get(`/documents?policyId=${policy.id}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.documents.length, 1);
    assert.equal(list.body.data.documents[0].filename, "My Policy 2026.pdf");
    assert.equal(list.body.data.documents[0].policyId, policy.id);
    assert.match(list.body.data.documents[0].fingerprint, /^[0-9a-f]{8}$/);
  });

  test("the whole hash is never sent to the browser", async () => {
    // Eight characters identify a file to a person; the full digest is a lookup
    // key into every upload on the platform.
    const list = await api(cookie).get("/documents");
    for (const doc of list.body.data.documents) {
      assert.equal(doc.fingerprint.length, 8);
      assert.ok(!JSON.stringify(doc).match(/[0-9a-f]{64}/), "a full hash reached the client");
    }
  });

  test("the file is written under the upload directory and nowhere else", async () => {
    const rows = await prisma.uploadedDocument.findMany({ select: { filepath: true } });
    assert.ok(rows.length > 0);
    for (const { filepath } of rows) {
      assert.ok(
        path.resolve(filepath).startsWith(path.resolve(UPLOAD_DIR) + path.sep),
        `${filepath} escaped the upload directory`
      );
    }
  });

  test("the name on disk is generated, never the one the browser sent", async () => {
    // A filename that arrived from a browser is not something to hand to a
    // filesystem. Two things stop it being one: the multipart parser drops the
    // directory part before we ever see it, and the disk name is generated from
    // a counter and the extension. The customer's name survives on the record,
    // which is where it is wanted.
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, unique(PDF), "../../escape me.pdf", "application/pdf");

    const row = await prisma.uploadedDocument.findFirst({
      where: { filepath: { not: "" } },
      orderBy: { uploadedAt: "desc" },
    });
    assert.ok(row, "the upload should have been recorded");
    assert.ok(!row.filename.includes("/"), `a path reached the record: ${row.filename}`);
    assert.match(path.basename(row.filepath), /^consumer-\d+-\d+\.pdf$/);
    assert.equal(path.dirname(path.resolve(row.filepath)), path.resolve(UPLOAD_DIR));
  });
});

// ── Security: what the door refuses ──────────────────────────────────────────

describe("files that are not what they claim", () => {
  let cookie;
  let policy;
  before(async () => {
    ({ cookie } = await account("security"));
    policy = await policyFor(cookie);
  });

  const refused = async (bytes, name, type) => {
    const before = filesOnDisk();
    const res = await attach(cookie, policy.id, bytes, name, type);
    assert.equal(res.status, 400, `${name} should have been refused: ${JSON.stringify(res.body)}`);
    // Nothing rejected may be left behind on disk.
    assert.equal(filesOnDisk(), before, `${name} left a file behind`);
    return res;
  };

  test("an executable renamed to .pdf is caught by its bytes", async () => {
    // The declared type and the extension both say PDF. Only the magic bytes
    // disagree, which is exactly the case the first gate cannot see.
    await refused(unique(EXE), "invoice.pdf", "application/pdf");
  });

  test("a PNG renamed to .pdf is caught, even though PNG is allowed", async () => {
    // Being an accepted format is not enough: the content has to be the format
    // the name claims, or everything downstream reasons about the wrong thing.
    await refused(unique(PNG), "certificate.pdf", "application/pdf");
  });

  test("a HEIC photo renamed to .jpg is caught", async () => {
    await refused(unique(HEIC), "photo.jpg", "image/jpeg");
  });

  test("formats the platform allows but this flow does not are refused", async () => {
    // DOCX, WEBP, MP4 are all legitimate elsewhere on the platform. Here they
    // are not, and the refusal names what to send instead.
    const res = await refused(unique(DOCX), "policy.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.match(res.body.message, /PDF, JPG or PNG/);
    await refused(unique(WEBP), "photo.webp", "image/webp");
    await refused(unique(MP4), "walkaround.mp4", "video/mp4");
  });

  test("a WEBP renamed to .png gets past the door and is caught by the scan", async () => {
    // The extension and declared type are both acceptable, so the first gate
    // lets it through. The scanner reads WEBP and the name says PNG.
    await refused(unique(WEBP), "photo.png", "image/png");
  });

  test("an empty file is refused rather than stored as an unreadable document", async () => {
    await refused(Buffer.alloc(0), "certificate.pdf", "application/pdf");
  });

  test("a file over the configured limit is refused with the limit in words", async () => {
    const res = await refused(
      Buffer.concat([PDF, Buffer.alloc(8192, 0x41)]),
      "huge.pdf",
      "application/pdf"
    );
    assert.match(res.body.message, /too large/i);
    assert.match(res.body.message, /4 KB|4\.0 KB/);
  });

  test("no file at all is answered with what to send", async () => {
    const res = await api(cookie).post(`/policies/${policy.id}/document`);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /PDF, JPG or PNG/);
  });

  test("nothing refused is recorded as an accusation", async () => {
    // The audit trail carries the reason; the customer is told what to send.
    // Neither says anything about the person who sent it.
    const rejections = await prisma.auditLog.findMany({ where: { action: "document.rejected" } });
    assert.ok(rejections.length > 0, "rejections should be recorded");
    for (const row of rejections) {
      assert.ok(!/fraud|fake|suspicious/i.test(JSON.stringify(row)), JSON.stringify(row));
    }
  });

  test("a refused upload never reaches the policy", async () => {
    const res = await api(cookie).get(`/policies/${policy.id}`);
    assert.equal(res.body.data.policy.trust.hasDocument, false);
    assert.equal(res.body.data.policy.trust.state, "UPLOADED");
  });
});

// ── Ownership ────────────────────────────────────────────────────────────────

describe("one customer cannot reach another's document", () => {
  let mine;
  let theirs;
  let myPolicy;
  let myDocumentId;

  before(async () => {
    mine = await account("owner");
    theirs = await account("stranger");
    myPolicy = await policyFor(mine.cookie);
    const res = await attach(mine.cookie, myPolicy.id, unique(PDF), "mine.pdf", "application/pdf");
    assert.equal(res.status, 201);
    const list = await api(mine.cookie).get("/documents");
    myDocumentId = list.body.data.documents[0].id;
  });

  test("uploading to somebody else's policy reports the policy as absent", async () => {
    const before = filesOnDisk();
    const res = await attach(theirs.cookie, myPolicy.id, unique(PDF), "theirs.pdf", "application/pdf");
    assert.equal(res.status, 404);
    // And the file they sent is not left sitting in the upload directory.
    assert.equal(filesOnDisk(), before);
  });

  test("reading its metadata reports it as absent", async () => {
    const res = await api(theirs.cookie).get(`/documents/${myDocumentId}`);
    assert.equal(res.status, 404);
  });

  test("fetching the file itself reports it as absent", async () => {
    const res = await api(theirs.cookie).get(`/documents/${myDocumentId}/file`);
    assert.equal(res.status, 404);
  });

  test("their list does not contain it", async () => {
    const res = await api(theirs.cookie).get("/documents");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.documents.length, 0);
  });

  test("asking for my documents filtered by their policy returns nothing", async () => {
    const theirPolicy = await policyFor(theirs.cookie);
    const res = await api(mine.cookie).get(`/documents?policyId=${theirPolicy.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.documents.length, 0);
  });

  test("a policy pointing at a stranger's document has no document", async () => {
    // `HeldPolicy.documentId` is not a foreign key, so this state is reachable
    // by a bad write. It must read as "no certificate", never as somebody
    // else's — and it must certainly not read as verified.
    const theirPolicy = await policyFor(theirs.cookie);
    await prisma.heldPolicy.update({
      where: { id: theirPolicy.id },
      data: { documentId: myDocumentId },
    });

    const res = await api(theirs.cookie).get(`/policies/${theirPolicy.id}`);
    assert.equal(res.body.data.policy.trust.hasDocument, false);
    assert.equal(res.body.data.policy.trust.state, "UPLOADED");
  });

  test("signing out closes the door entirely", async () => {
    for (const p of ["/documents", `/documents/${myDocumentId}`, `/documents/${myDocumentId}/file`]) {
      const res = await request(app).get(`${API}${p}`).set("Origin", ORIGIN);
      assert.equal(res.status, 401, p);
    }
    const upload = await request(app)
      .post(`${API}/policies/${myPolicy.id}/document`)
      .set("Origin", ORIGIN)
      .attach("file", unique(PDF), { filename: "x.pdf", contentType: "application/pdf" });
    assert.equal(upload.status, 401);
  });
});

// ── Duplicates ───────────────────────────────────────────────────────────────

describe("the same file, twice", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("dupes")); });

  test("uploading it again to the same policy is not an error", async () => {
    // A refreshed page or a repeated tap on a slow connection. Refusing it
    // would teach a nervous customer that they broke something.
    const policy = await policyFor(cookie);
    const bytes = unique(PDF);

    const first = await attach(cookie, policy.id, bytes, "cert.pdf", "application/pdf");
    assert.equal(first.status, 201);
    const before = filesOnDisk();

    const second = await attach(cookie, policy.id, bytes, "cert.pdf", "application/pdf");
    assert.equal(second.status, 201);
    assert.equal(second.body.data.policy.trust.state, "CONSISTENCY_VERIFIED");
    // The second copy is not kept: the stored row is reused.
    assert.equal(filesOnDisk(), before);

    const list = await api(cookie).get(`/documents?policyId=${policy.id}`);
    assert.equal(list.body.data.documents.length, 1);
  });

  test("the same file on two policies is raised as a question, not refused", async () => {
    const one = await policyFor(cookie);
    const two = await policyFor(cookie);
    const bytes = unique(PDF);

    assert.equal((await attach(cookie, one.id, bytes, "cert.pdf", "application/pdf")).status, 201);
    const res = await attach(cookie, two.id, bytes, "cert.pdf", "application/pdf");

    assert.equal(res.status, 201);
    assert.equal(res.body.data.policy.trust.state, "VERIFICATION_REQUIRED");
    // And it is put to the customer as a question about a file, not a finding
    // about them.
    assert.match(res.body.data.policy.trustCopy.reason, /same file you added to another policy/i);
    assert.match(res.body.data.policy.trustCopy.action, /Nothing for you to do/i);
  });

  test("the first policy is asked about too, because the question is about both", async () => {
    const list = await api(cookie).get("/policies");
    const flagged = list.body.data.policies.filter(
      (p) => p.trust.state === "VERIFICATION_REQUIRED"
    );
    assert.equal(flagged.length, 2);
  });

  test("the same policy number on two policies is raised as a question", async () => {
    const { cookie: fresh } = await account("dupe-number");
    const shared = { policyNumber: "POL/SHARED/0001" };
    await policyFor(fresh, shared);
    const second = await policyFor(fresh, shared);

    const res = await api(fresh).get(`/policies/${second.id}`);
    assert.equal(res.body.data.policy.trust.state, "VERIFICATION_REQUIRED");
    assert.match(res.body.data.policy.trustCopy.reason, /small typing slip/i);
  });

  test("a different customer with the same certificate is nobody's business", async () => {
    // Duplicate detection is scoped to one person. A cross-customer check would
    // leak something about a stranger's record and be wrong more often than
    // right — a certificate legitimately moves when a vehicle is sold.
    const { cookie: other } = await account("dupe-other");
    const policy = await policyFor(other);
    const shared = Buffer.from([...ascii("%PDF-1.4"), 0x0a, ...ascii("shared bytes exactly")]);

    const mine = await policyFor(cookie);
    assert.equal((await attach(cookie, mine.id, shared, "c.pdf", "application/pdf")).status, 201);

    const res = await attach(other, policy.id, shared, "c.pdf", "application/pdf");
    assert.equal(res.status, 201);
    assert.equal(res.body.data.policy.trust.state, "CONSISTENCY_VERIFIED");
  });
});

// ── The trust gate, through the API ──────────────────────────────────────────

describe("what the policy says about itself", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("trust")); });

  test("a new policy with no certificate says so plainly", async () => {
    const policy = await policyFor(cookie);
    assert.equal(policy.trust.state, "UPLOADED");
    assert.match(policy.trustCopy.reason, /exactly what you typed in/i);
    assert.match(policy.trustCopy.action, /optional/i);
  });

  test('"I am not sure" about the cover type asks, and does not judge', async () => {
    const policy = await policyFor(cookie, { policyType: "UNKNOWN" });
    assert.equal(policy.trust.state, "NEEDS_CONFIRMATION");
    assert.match(policy.trustCopy.reason, /perfectly normal answer/i);
  });

  test("a policy that has already expired is asked about", async () => {
    const policy = await policyFor(cookie, { expiryDate: dateIn(-10) });
    assert.equal(policy.trust.state, "NEEDS_CONFIRMATION");
    assert.match(policy.trustCopy.reason, /already passed/i);
  });

  test("correcting the expiry date moves the state without another upload", async () => {
    const policy = await policyFor(cookie, { expiryDate: dateIn(-10) });
    const res = await api(cookie).patch(`/policies/${policy.id}`).send({ expiryDate: dateIn(90) });
    assert.equal(res.body.data.policy.trust.state, "UPLOADED");
  });

  test("the stored column keeps up with what the customer was shown", async () => {
    // Reads recompute; the column is the snapshot an operations queue and the
    // audit trail read later. They must not disagree straight after a write.
    const policy = await policyFor(cookie, { policyType: "UNKNOWN" });
    const row = await prisma.heldPolicy.findUnique({ where: { id: policy.id } });
    assert.equal(row.verificationState, "NEEDS_CONFIRMATION");
    assert.ok(row.verificationNote && row.verificationNote.length > 0);
  });

  test("every state comes with the note saying what was actually checked", async () => {
    const res = await api(cookie).get("/policies");
    for (const policy of res.body.data.policies) {
      assert.match(policy.trustCopy.scopeNote, /not a confirmation from your insurer/i);
    }
  });

  test("it answers in Tamil when asked to", async () => {
    const policy = await policyFor(cookie);
    const res = await api(cookie).get(`/policies/${policy.id}?locale=ta`);
    assert.equal(res.status, 200);
    assert.match(res.body.data.policy.trustCopy.label, /[஀-௿]/);
    assert.match(res.body.data.policy.trustCopy.scopeNote, /[஀-௿]/);
  });

  test("the manual details are never rewritten by a document", async () => {
    // Manual entry is the source of truth in this milestone. Nothing about
    // attaching a file may change a field the customer typed.
    const policy = await policyFor(cookie);
    const before = await api(cookie).get(`/policies/${policy.id}`);
    await attach(cookie, policy.id, unique(PDF), "cert.pdf", "application/pdf");
    const after = await api(cookie).get(`/policies/${policy.id}`);

    for (const field of ["insurer", "policyNumberMasked", "policyType", "expiryDate", "idv"]) {
      assert.deepEqual(
        after.body.data.policy[field],
        before.body.data.policy[field],
        `${field} changed`
      );
    }
  });
});

// ── Preview ──────────────────────────────────────────────────────────────────

describe("previewing a document", () => {
  let cookie;
  let documentId;
  const bytes = Buffer.from([...ascii("%PDF-1.4"), 0x0a, ...ascii("preview me please")]);

  before(async () => {
    ({ cookie } = await account("preview"));
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, bytes, "cert.pdf", "application/pdf");
    const list = await api(cookie).get("/documents");
    documentId = list.body.data.documents[0].id;
  });

  test("the bytes come back exactly as they were stored", async () => {
    const res = await api(cookie).get(`/documents/${documentId}/file`);
    assert.equal(res.status, 200);
    assert.deepEqual(Buffer.from(res.body), bytes);
  });

  test("it is served inline, un-sniffable and never cached", async () => {
    const res = await api(cookie).get(`/documents/${documentId}/file`);
    assert.match(res.headers["content-type"], /application\/pdf/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.match(res.headers["cache-control"], /no-store/);
    assert.match(res.headers["content-disposition"], /^inline;/);
  });

  test("the content type is the one we detected, never the one the browser declared", async () => {
    // A stored `text/html` echoed back would be a cross-site scripting hole on
    // our own origin, delivered by the customer's own upload.
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, unique(PNG), "photo.png", "application/pdf");

    const list = await api(cookie).get(`/documents?policyId=${policy.id}`);
    const res = await api(cookie).get(`/documents/${list.body.data.documents[0].id}/file`);
    assert.match(res.headers["content-type"], /image\/png/);
  });

  test("a filename that would break the header is encoded, not echoed", async () => {
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, unique(PDF), 'we"ird\nname.pdf', "application/pdf");

    const list = await api(cookie).get(`/documents?policyId=${policy.id}`);
    const res = await api(cookie).get(`/documents/${list.body.data.documents[0].id}/file`);
    assert.equal(res.status, 200);
    assert.ok(!res.headers["content-disposition"].includes('"'));
    assert.ok(!res.headers["content-disposition"].includes("\n"));
  });

  test("a document whose file has gone reads as unavailable, not as an error", async () => {
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, unique(PDF), "vanishing.pdf", "application/pdf");
    const list = await api(cookie).get(`/documents?policyId=${policy.id}`);
    const id = list.body.data.documents[0].id;

    const row = await prisma.uploadedDocument.findUnique({ where: { id } });
    fs.unlinkSync(row.filepath);

    const res = await api(cookie).get(`/documents/${id}/file`);
    assert.equal(res.status, 404);
    assert.match(res.body.message, /not available/i);
  });

  test("a row pointing outside the upload directory is refused", async () => {
    // Nothing writes such a row. It is checked anyway, because "nothing writes
    // it" is the assumption that turns one bad row into an arbitrary file read.
    const policy = await policyFor(cookie);
    await attach(cookie, policy.id, unique(PDF), "ok.pdf", "application/pdf");
    const list = await api(cookie).get(`/documents?policyId=${policy.id}`);
    const id = list.body.data.documents[0].id;

    await prisma.uploadedDocument.update({
      where: { id },
      data: { filepath: "/etc/passwd" },
    });

    const res = await api(cookie).get(`/documents/${id}/file`);
    assert.equal(res.status, 404);
  });
});
