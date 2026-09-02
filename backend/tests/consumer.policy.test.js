/**
 * The Aegis Consumer policy flow, driven through the real app.
 *
 * One property decides whether this is safe, and most of this file is about it:
 * a customer can reach their own policies and nothing else. The rest covers the
 * two things a customer notices when they are wrong — that the renewal status
 * on a policy matches the date they typed, and that deleting a policy leaves
 * the record that it existed.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3000";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-consumer-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after, before } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";
const API = "/api/v1/consumer";

after(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag) {
  seq += 1;
  const email = `consumer-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Person ${tag}`, email, password: PASSWORD });
  assert.equal(res.status, 201, `registration failed: ${JSON.stringify(res.body)}`);
  return { cookie: cookieHeader(res), userId: res.body.data.user.id, email };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  post: (p) => request(app).post(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  patch: (p) => request(app).patch(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
  delete: (p) => request(app).delete(`${API}${p}`).set("Cookie", cookie).set("Origin", ORIGIN),
});

/** A calendar date `days` from today, as the form sends it. */
function dateIn(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const policyBody = (overrides = {}) => ({
  insurer: "Bharat General Insurance",
  policyNumber: "POL/2026/000123",
  policyType: "COMPREHENSIVE",
  expiryDate: dateIn(45),
  vehicle: { registrationNumber: "TN 09 AB 1234", vehicleType: "BIKE", make: "Hero" },
  ...overrides,
});

// ── Creating ─────────────────────────────────────────────────────────────────

describe("adding a policy by hand", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("create")); });

  test("stores the policy and the vehicle together", async () => {
    const res = await api(cookie).post("/policies").send(policyBody());
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const { policy } = res.body.data;
    assert.equal(policy.insurer, "Bharat General Insurance");
    assert.equal(policy.policyType, "COMPREHENSIVE");
    assert.equal(policy.vehicle.registrationNumber, "TN 09 AB 1234");
    assert.equal(policy.vehicle.vehicleType, "BIKE");
    assert.equal(policy.enteredVia, "MANUAL");
  });

  test("creates the insurance profile for a customer who has never had one", async () => {
    // A customer entering their first policy has usually never filled in a
    // profile. Demanding one first would ask about their income before telling
    // them when their insurance runs out.
    const fresh = await account("no-profile");
    const before = await prisma.insuranceProfile.findUnique({ where: { userId: fresh.userId } });
    assert.equal(before, null);

    const res = await api(fresh.cookie).post("/policies").send(policyBody());
    assert.equal(res.status, 201);

    const after = await prisma.insuranceProfile.findUnique({ where: { userId: fresh.userId } });
    assert.ok(after, "the profile should have been created");
  });

  test("never sends the whole policy number back", async () => {
    const res = await api(cookie).post("/policies").send(
      policyBody({ policyNumber: "POL9999888877776666", vehicle: { registrationNumber: "TN 10 ZZ 9999", vehicleType: "CAR" } })
    );
    assert.equal(res.status, 201);
    const masked = res.body.data.policy.policyNumberMasked;
    assert.ok(masked.endsWith("6666"), "the last four are how somebody recognises their own policy");
    assert.ok(!masked.includes("9999888"), "the rest must not be sent");
    assert.equal(res.body.data.policy.policyNumber, undefined);
  });

  test("the same vehicle entered twice is one vehicle, not an error", async () => {
    const owner = await account("same-vehicle");
    const first = await api(owner.cookie).post("/policies").send(policyBody());
    const second = await api(owner.cookie).post("/policies").send(
      policyBody({ policyNumber: "POL/2027/000999", expiryDate: dateIn(400) })
    );

    assert.equal(first.status, 201);
    assert.equal(second.status, 201, "renewing next year must not be refused");
    assert.equal(
      first.body.data.policy.vehicle.id,
      second.body.data.policy.vehicle.id,
      "both policies should hang off the one bike"
    );
  });

  test("spacing and punctuation do not make a second vehicle", async () => {
    const owner = await account("norm-vehicle");
    const a = await api(owner.cookie).post("/policies").send(
      policyBody({ vehicle: { registrationNumber: "TN 09 AB 1234", vehicleType: "BIKE" } })
    );
    const b = await api(owner.cookie).post("/policies").send(
      policyBody({ policyNumber: "POL/2/2", vehicle: { registrationNumber: "tn-09-ab-1234", vehicleType: "BIKE" } })
    );
    assert.equal(a.body.data.policy.vehicle.id, b.body.data.policy.vehicle.id);
  });

  test("two customers may hold the same plate — a vehicle gets sold", async () => {
    const seller = await account("seller");
    const buyer = await account("buyer");
    const plate = { registrationNumber: "TN 22 SOLD 1", vehicleType: "SCOOTER" };

    const one = await api(seller.cookie).post("/policies").send(policyBody({ vehicle: plate }));
    const two = await api(buyer.cookie).post("/policies").send(policyBody({ vehicle: plate }));

    assert.equal(one.status, 201);
    assert.equal(two.status, 201, "the new owner must not be blocked by the old one");
  });
});

// ── Validation at the door ───────────────────────────────────────────────────

describe("what the API refuses", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("validation")); });

  const rejects = async (body, because) => {
    const res = await api(cookie).post("/policies").send(body);
    assert.equal(res.status, 400, `${because}: expected 400, got ${res.status}`);
    return res.body.message || "";
  };

  test("an expiry date is required — it is the whole answer", async () => {
    const body = policyBody();
    delete body.expiryDate;
    const message = await rejects(body, "no expiry");
    assert.match(message, /expiry date is required/i);
  });

  test("a date that is not a date", async () => {
    await rejects(policyBody({ expiryDate: "next Tuesday" }), "prose");
    await rejects(policyBody({ expiryDate: "2026-02-31" }), "February 31st");
    await rejects(policyBody({ expiryDate: "01/09/2026" }), "the wrong format");
  });

  test("a year with an extra digit is caught rather than stored", async () => {
    await rejects(policyBody({ expiryDate: "20265-09-01" }), "typo in the year");
  });

  test("a start date after the expiry date", async () => {
    const message = await rejects(
      policyBody({ startDate: dateIn(90), expiryDate: dateIn(30) }),
      "transposed dates"
    );
    assert.match(message, /start date must be before/i);
  });

  test("an unknown policy type — but UNKNOWN itself is accepted", async () => {
    await rejects(policyBody({ policyType: "GOLD_PLATED" }), "invented type");

    const res = await api(cookie).post("/policies").send(
      policyBody({ policyType: "UNKNOWN", vehicle: { registrationNumber: "TN 01 UNK 1", vehicleType: "CAR" } })
    );
    assert.equal(res.status, 201, "not knowing is a real answer");
    assert.equal(res.body.data.policy.policyType, "UNKNOWN");
  });

  test("an unknown vehicle type", async () => {
    await rejects(
      policyBody({ vehicle: { registrationNumber: "TN 01 AA 1", vehicleType: "TRACTOR" } }),
      "not one of the three"
    );
  });

  test("a policy with no vehicle at all", async () => {
    const body = policyBody();
    delete body.vehicle;
    await rejects(body, "nothing to insure");
  });

  test("fields the customer is not allowed to set", async () => {
    // The lesson `leadUpdateSchema` records: an allow-list, so a column added
    // later is not writable through this route by default.
    for (const field of ["deletedAt", "verificationState", "profileId", "enteredVia", "domain"]) {
      const message = await rejects(policyBody({ [field]: "x" }), `writing ${field}`);
      assert.match(message, /cannot be set here/i);
    }
  });

  test("an absurdly long insurer name", async () => {
    await rejects(policyBody({ insurer: "A".repeat(500) }), "unbounded text");
  });

  test("a negative or impossible no-claim bonus", async () => {
    await rejects(policyBody({ ncbPercent: -10 }), "negative NCB");
    await rejects(policyBody({ ncbPercent: 5000 }), "impossible NCB");
  });

  test("an unfamiliar plate format is accepted, not turned away", async () => {
    // Older and out-of-state formats must reach the flow. Refusing them at the
    // first field is how this product would lose the people it is for.
    const res = await api(cookie).post("/policies").send(
      policyBody({ policyNumber: "POL/OLD/1", vehicle: { registrationNumber: "MYS 4021", vehicleType: "CAR" } })
    );
    assert.equal(res.status, 201);
  });
});

// ── Renewal status ───────────────────────────────────────────────────────────

describe("the renewal status on a stored policy", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("status")); });

  const BANDS = [
    [400, "ACTIVE"],
    [45, "RENEWAL_COMING_SOON"],
    [20, "ACTION_SOON"],
    [3, "URGENT_RENEWAL"],
    [0, "POLICY_MAY_BE_EXPIRED"],
    [-30, "POLICY_MAY_BE_EXPIRED"],
  ];

  for (const [days, expected] of BANDS) {
    test(`an expiry ${days} days away reads as ${expected}`, async () => {
      const res = await api(cookie).post("/policies").send(
        policyBody({
          expiryDate: dateIn(days),
          policyNumber: `POL/BAND/${days}`,
          vehicle: { registrationNumber: `TN 33 BB ${1000 + days}`, vehicleType: "BIKE" },
        })
      );
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.data.policy.renewal.ok, true);
      assert.equal(res.body.data.policy.renewal.status, expected);
      assert.equal(res.body.data.policy.renewal.daysRemaining, days);
    });
  }

  test("every response carries the guidance disclaimer", async () => {
    // Requirement 11. Returned alongside the status so a screen cannot omit it
    // by simply not asking for it.
    const res = await api(cookie).get("/policies");
    assert.equal(res.status, 200);
    assert.match(res.body.data.disclaimer, /^Guidance only\./);
    for (const policy of res.body.data.policies) {
      assert.match(policy.copy.disclaimer, /^Guidance only\./);
      assert.ok(policy.copy.status.length > 0);
      assert.ok(policy.copy.nextAction.length > 0);
    }
  });

  test("answers in Tamil when asked to", async () => {
    const res = await api(cookie).get("/policies?locale=ta");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.locale, "ta");
    assert.match(res.body.data.disclaimer, /[஀-௿]/, "the Tamil disclaimer should be Tamil");
  });

  test("refuses a language it cannot render rather than guessing", async () => {
    const res = await api(cookie).get("/policies?locale=fr");
    assert.equal(res.status, 400);
  });

  test("lists the soonest expiry first", async () => {
    const res = await api(cookie).get("/policies");
    const dates = res.body.data.policies.map((p) => p.expiryDate);
    assert.deepEqual([...dates].sort(), dates, "the policy that needs attention must be first");
  });
});

// ── Ownership ────────────────────────────────────────────────────────────────

describe("one customer cannot reach another's policy", () => {
  let mine, theirs, myPolicyId;

  before(async () => {
    mine = await account("owner");
    theirs = await account("stranger");
    const res = await api(mine.cookie).post("/policies").send(policyBody());
    myPolicyId = res.body.data.policy.id;
  });

  test("reading it reports absent, not forbidden", async () => {
    // A 403 would confirm the id exists, turning a list of guesses into a
    // census of the platform's policies. 404 says only that this person has no
    // such policy, which is true.
    const res = await api(theirs.cookie).get(`/policies/${myPolicyId}`);
    assert.equal(res.status, 404);
  });

  test("editing it is refused", async () => {
    const res = await api(theirs.cookie).patch(`/policies/${myPolicyId}`).send({ insurer: "Theirs Now" });
    assert.equal(res.status, 404);

    const still = await prisma.heldPolicy.findUnique({ where: { id: myPolicyId } });
    assert.equal(still.insurer, "Bharat General Insurance", "it must be untouched");
  });

  test("deleting it is refused", async () => {
    const res = await api(theirs.cookie).delete(`/policies/${myPolicyId}`);
    assert.equal(res.status, 404);

    const still = await prisma.heldPolicy.findUnique({ where: { id: myPolicyId } });
    assert.equal(still.deletedAt, null, "it must still be there");
  });

  test("their list does not contain it", async () => {
    const res = await api(theirs.cookie).get("/policies");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.policies.find((p) => p.id === myPolicyId), undefined);
  });

  test("a stranger cannot attach my vehicle to their policy", async () => {
    const myVehicles = await api(mine.cookie).get("/vehicles");
    const myVehicleId = myVehicles.body.data.vehicles[0].id;

    const res = await api(theirs.cookie).post("/policies").send({
      insurer: "Someone Else",
      policyNumber: "POL/X/1",
      policyType: "THIRD_PARTY",
      expiryDate: dateIn(10),
      vehicleId: myVehicleId,
    });
    assert.equal(res.status, 404);
  });

  test("a stranger cannot rename my vehicle", async () => {
    const myVehicles = await api(mine.cookie).get("/vehicles");
    const myVehicleId = myVehicles.body.data.vehicles[0].id;

    const res = await api(theirs.cookie).patch(`/vehicles/${myVehicleId}`).send({ make: "Hijacked" });
    assert.equal(res.status, 404);
  });

  test("signing out closes the door entirely", async () => {
    const res = await request(app).get(`${API}/policies`).set("Origin", ORIGIN);
    assert.equal(res.status, 401);
  });
});

// ── Editing and removing ─────────────────────────────────────────────────────

describe("correcting and removing a policy", () => {
  let cookie, userId, policyId;

  before(async () => {
    ({ cookie, userId } = await account("edit"));
    const res = await api(cookie).post("/policies").send(policyBody());
    policyId = res.body.data.policy.id;
  });

  test("a correction changes only what was sent", async () => {
    const res = await api(cookie).patch(`/policies/${policyId}`).send({ insurer: "Corrected Insurer" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.policy.insurer, "Corrected Insurer");
    // An absent field means "leave it alone", not "clear it".
    assert.equal(res.body.data.policy.policyType, "COMPREHENSIVE");
    assert.equal(res.body.data.policy.vehicle.registrationNumber, "TN 09 AB 1234");
  });

  test("correcting the expiry date recomputes the status", async () => {
    const res = await api(cookie).patch(`/policies/${policyId}`).send({ expiryDate: dateIn(2) });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.policy.renewal.status, "URGENT_RENEWAL");
    assert.equal(res.body.data.policy.renewal.daysRemaining, 2);
  });

  test("an empty correction is refused rather than silently doing nothing", async () => {
    const res = await api(cookie).patch(`/policies/${policyId}`).send({});
    assert.equal(res.status, 400);
  });

  test("deleting is soft, and the row survives", async () => {
    const res = await api(cookie).delete(`/policies/${policyId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deleted, true);

    const row = await prisma.heldPolicy.findUnique({ where: { id: policyId } });
    assert.ok(row, "the row must survive — the audit trail outlives the list entry");
    assert.ok(row.deletedAt instanceof Date);
  });

  test("a deleted policy leaves the list and cannot be read", async () => {
    const list = await api(cookie).get("/policies");
    assert.equal(list.body.data.policies.find((p) => p.id === policyId), undefined);

    const one = await api(cookie).get(`/policies/${policyId}`);
    assert.equal(one.status, 404);
  });

  test("deleting it twice is refused, not counted twice", async () => {
    const res = await api(cookie).delete(`/policies/${policyId}`);
    assert.equal(res.status, 404);
  });

  test("the deletion is on the audit trail", async () => {
    // What survives is the record that this person entered this policy and was
    // advised about it — the thing a complaint asks about months later.
    await new Promise((resolve) => setTimeout(resolve, 150)); // the write is fire-and-forget
    const entries = await prisma.auditLog.findMany({
      where: { actorId: userId, entityId: policyId },
      orderBy: { createdAt: "asc" },
    });
    const actions = entries.map((e) => e.action);
    assert.ok(actions.includes("consumer.policy.created"), `got ${actions.join(", ")}`);
    assert.ok(actions.includes("consumer.policy.deleted"), `got ${actions.join(", ")}`);
  });

  test("the audit trail carries no policy number or registration", async () => {
    const entries = await prisma.auditLog.findMany({ where: { actorId: userId } });
    for (const entry of entries) {
      const blob = entry.metadata ?? "";
      assert.ok(!blob.includes("000123"), "a policy number must not be in the audit metadata");
      assert.ok(!blob.includes("TN 09"), "a registration must not be in the audit metadata");
    }
  });
});

// ── Vehicles ─────────────────────────────────────────────────────────────────

describe("vehicles", () => {
  let cookie;
  before(async () => { ({ cookie } = await account("vehicles")); });

  test("can be created on their own and listed back", async () => {
    const created = await api(cookie).post("/vehicles").send({
      registrationNumber: "TN 44 CC 5678",
      vehicleType: "SCOOTER",
      make: "Honda",
      model: "Activa",
    });
    assert.equal(created.status, 201);

    const list = await api(cookie).get("/vehicles");
    assert.equal(list.status, 200);
    assert.ok(list.body.data.vehicles.some((v) => v.registrationNumber === "TN 44 CC 5678"));
  });

  test("can be corrected", async () => {
    const list = await api(cookie).get("/vehicles");
    const id = list.body.data.vehicles[0].id;

    const res = await api(cookie).patch(`/vehicles/${id}`).send({ model: "Activa 6G" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.vehicle.model, "Activa 6G");
  });

  test("cannot be renamed onto a plate the customer already holds", async () => {
    await api(cookie).post("/vehicles").send({ registrationNumber: "TN 55 DD 1111", vehicleType: "CAR" });
    const list = await api(cookie).get("/vehicles");
    const other = list.body.data.vehicles.find((v) => v.registrationNumber === "TN 44 CC 5678");

    const res = await api(cookie).patch(`/vehicles/${other.id}`).send({ registrationNumber: "TN-55-DD-1111" });
    assert.equal(res.status, 409, "a clash must be a sentence, not a 500");
  });
});
