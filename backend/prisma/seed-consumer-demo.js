const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
// Run through tsx (see `npm run db:seed:consumer`) so the real consent hash can
// be imported rather than reimplemented. A demo consent carrying a hash this
// script invented would look like a tampered one to anybody checking it.
const { consentTextHash } = require("../src/consumer/consentHash");
const { CONSENT_TEXT_VERSION } = require("../src/consumer/messages");

const prisma = new PrismaClient();

/**
 * Demo data for the Aegis Consumer flow.
 *
 * Separate from `seed.js`, and separate on purpose. That script seeds the
 * product catalogue and deliberately creates no accounts, because accounts are
 * made through registration where the password rules and the audit trail apply.
 * This one does create an account — which is exactly why it is not part of the
 * default seed and refuses to run in production.
 *
 * What it puts in place is a customer whose policies sit in four different
 * renewal bands at once, which is the only way to see the status engine,
 * the trust gate and the renewal queue doing anything without waiting months for
 * dates to pass. Everything is derived from today, so the demo is correct
 * whenever it is run rather than correct on the day it was written.
 *
 * Idempotent: matched on the demo email and on registration numbers, so running
 * it twice refreshes the dates instead of stacking a second set of policies.
 *
 *   node prisma/seed-consumer-demo.js
 */

const DEMO_EMAIL = process.env.CONSUMER_DEMO_EMAIL || "demo.customer@aegis.test";
const DEMO_PASSWORD = process.env.CONSUMER_DEMO_PASSWORD || "demo-only-not-a-real-secret";

/** A calendar date `days` from today, stored the way the platform stores dates. */
function dateIn(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const normalise = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * One policy per renewal band, so every state the product can be in is on
 * screen at once.
 *
 * The trust states fall out of the data rather than being set: the third has no
 * insurer and an UNKNOWN cover type, so the gate puts it in NEEDS_CONFIRMATION
 * on its own. Writing the state directly would have demoed the column rather
 * than the engine.
 */
const POLICIES = [
  {
    label: "comfortably active",
    registrationNumber: "TN 09 BX 4412",
    vehicleType: "BIKE",
    make: "Hero",
    model: "Splendor Plus",
    insurer: "Bharat General Insurance",
    policyNumber: "BG/2WH/2026/774120",
    policyType: "COMPREHENSIVE",
    expiryInDays: 240,
    idv: 58000,
    ncbPercent: 25,
  },
  {
    label: "renewal coming up",
    registrationNumber: "TN 10 CK 9087",
    vehicleType: "CAR",
    make: "Maruti Suzuki",
    model: "Swift VXi",
    insurer: "Chola Motor Assurance",
    policyNumber: "CMA/PC/2026/551903",
    policyType: "COMPREHENSIVE",
    expiryInDays: 41,
    idv: 462000,
    ncbPercent: 45,
  },
  {
    label: "urgent, and incomplete on purpose",
    registrationNumber: "TN 07 AJ 2233",
    vehicleType: "SCOOTER",
    make: "Honda",
    model: null,
    // No insurer and no cover type: the trust gate should ask the customer to
    // confirm, which is the state most real records start in.
    insurer: null,
    policyNumber: "TP/SCT/2025/018844",
    policyType: "UNKNOWN",
    expiryInDays: 5,
    idv: null,
    ncbPercent: null,
  },
  {
    label: "may already have lapsed",
    registrationNumber: "TN 22 DL 5566",
    vehicleType: "BIKE",
    make: "Bajaj",
    model: "Pulsar 150",
    insurer: "Nadu General",
    policyNumber: "NG/2WH/2025/330277",
    policyType: "THIRD_PARTY",
    expiryInDays: -12,
    idv: 41000,
    ncbPercent: 0,
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Refusing to seed demo data in production. This script creates an account with a known password."
    );
    process.exit(1);
  }

  console.log("Seeding Aegis Consumer demo data (nothing is deleted)...");

  // 1) The demo customer. Registered the ordinary way — hashed password, the
  //    `customer` role, no capabilities — so the demo exercises the same
  //    authorisation path a real person does.
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: "Meena Ravichandran", preferredLanguage: "en" },
      })
    : await prisma.user.create({
        data: {
          name: "Meena Ravichandran",
          email: DEMO_EMAIL,
          password: await bcrypt.hash(DEMO_PASSWORD, 10),
          realm: "CUSTOMER",
          role: "CUSTOMER",
          preferredLanguage: "en",
        },
      });
  console.log(`Customer ${existing ? "updated" : "created"}: ${user.email}`);

  const profile =
    (await prisma.insuranceProfile.findUnique({ where: { userId: user.id } })) ??
    (await prisma.insuranceProfile.create({ data: { userId: user.id, source: "SELF" } }));

  // 2) The policies, one per renewal band.
  const saved = [];
  for (const spec of POLICIES) {
    const registrationNorm = normalise(spec.registrationNumber);
    const vehicle = await prisma.vehicle.upsert({
      where: { ownerId_registrationNorm: { ownerId: user.id, registrationNorm } },
      create: {
        ownerId: user.id,
        registrationNumber: spec.registrationNumber,
        registrationNorm,
        vehicleType: spec.vehicleType,
        make: spec.make,
        model: spec.model,
      },
      update: { vehicleType: spec.vehicleType, make: spec.make, model: spec.model, deletedAt: null },
    });

    const policyNumberNorm = normalise(spec.policyNumber);
    const found = await prisma.heldPolicy.findFirst({
      where: { profileId: profile.id, vehicleId: vehicle.id, domain: "motor" },
    });

    const data = {
      profileId: profile.id,
      domain: "motor",
      vehicleId: vehicle.id,
      insurer: spec.insurer,
      policyNumber: spec.policyNumber,
      policyNumberNorm,
      policyType: spec.policyType,
      renewalDate: dateIn(spec.expiryInDays),
      startDate: dateIn(spec.expiryInDays - 365),
      idv: spec.idv,
      ncbPercent: spec.ncbPercent,
      external: true,
      status: "ACTIVE",
      enteredVia: "MANUAL",
      deletedAt: null,
    };

    const policy = found
      ? await prisma.heldPolicy.update({ where: { id: found.id }, data })
      : await prisma.heldPolicy.create({ data });

    saved.push({ policy, spec });
    console.log(
      `  ${found ? "updated" : "seeded"}: ${spec.registrationNumber} — ${spec.label} (expires ${data.renewalDate.toISOString().slice(0, 10)})`
    );
  }

  // 3) One renewal request, on the urgent policy, with the consent behind it.
  //    Seeded together because the service refuses to create one without the
  //    other, and demo data that could not have been created through the product
  //    is demo data that hides a bug.
  const urgent = saved.find((entry) => entry.spec.expiryInDays === 5);
  if (urgent) {
    const openRequest = await prisma.renewalLead.findFirst({
      where: { userId: user.id, policyId: urgent.policy.id, deletedAt: null },
    });

    if (!openRequest) {
      const consent = await prisma.renewalConsent.create({
        data: {
          userId: user.id,
          channel: "CALL",
          purpose: "RENEWAL_ASSISTANCE",
          textVersion: CONSENT_TEXT_VERSION,
          // The real hash, from the real catalogue, so a demo row carries the
          // same proof a customer's own consent does.
          textHash: consentTextHash("RENEWAL_ASSISTANCE"),
          policyId: urgent.policy.id,
        },
      });

      await prisma.renewalLead.create({
        data: {
          userId: user.id,
          policyId: urgent.policy.id,
          status: "NEW",
          preferredChannel: "CALL",
          contactPhone: "+91 98400 12345",
          urgencyAtCreation: "HIGH",
          expiryAtCreation: urgent.policy.renewalDate,
          consentId: consent.id,
        },
      });
      console.log("  seeded: one renewal request waiting in the queue");
    } else {
      console.log("  kept: a renewal request already exists");
    }
  }

  console.log("");
  console.log("Demo ready.");
  console.log(`  Sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("  Four policies: active, coming up, urgent (incomplete), and possibly lapsed.");
  console.log("  The renewal queue needs an account with lead.read — promote one in the database.");
}

main()
  .catch((e) => {
    console.error("Error seeding consumer demo data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
