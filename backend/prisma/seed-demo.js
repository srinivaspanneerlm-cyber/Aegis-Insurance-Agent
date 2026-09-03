const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Fill one customer account with the history a real customer would have.
 *
 * A live demo of a guidance platform fails quietly on empty screens. The
 * advisor can be flawless, but a dashboard with no policies, no documents and
 * no notifications reads as "not built yet" to anybody watching — and the
 * three features that most need a populated account (renewal intelligence, the
 * document vault, the coverage-gap explanation) have nothing to say without
 * one.
 *
 * So this writes a household: a family floater bought here, a car policy bought
 * elsewhere that renews in nine days, term cover, and a parents' health policy
 * that has already lapsed. That last one is not decoration. Coverage gap
 * analysis and renewal nudges are the product's argument for existing, and both
 * are invisible on an account where nothing is about to go wrong.
 *
 * Like `seed.js`, it deletes nothing and is safe to run twice: every row is
 * upserted on a fixed, readable `demo-` id, so a second run updates in place.
 * It targets one account by email and touches no other.
 *
 *   node prisma/seed-demo.js                      # demo@aegisdemo.in
 *   DEMO_EMAIL=someone@example.com node prisma/seed-demo.js
 */

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@aegisdemo.in";

// Dates are written relative to the run so the demo never goes stale: a
// renewal hardcoded to a date in the past stops being urgent the week after
// it is seeded, which is exactly when somebody demonstrates it.
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);

const UPLOADS_DIR = path.join(__dirname, "..", "src", "uploads");

/**
 * A small, real file behind every document row.
 *
 * The vault lists rows from the database, but anybody clicking through in a
 * demo hits the file itself, and a 404 in front of an audience is worse than
 * no document at all. These are generated placeholders — never a copy of a
 * real customer's papers, which is also why the demo account does not reuse
 * the identity documents already sitting in this folder.
 */
function writePlaceholder(filename, title) {
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const body = `${title}\n\nSample document generated for the Aegis AI demo account.\nNot a real document and not real customer data.\n`;
  // A minimal single-page PDF, written by hand so the seed needs no PDF
  // dependency. Enough structure for a viewer to open it.
  const text = body.split("\n").filter(Boolean);
  const lines = text
    .map((l, i) => `BT /F1 12 Tf 60 ${760 - i * 20} Td (${l.replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");
  const content = `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${lines.length}>>stream
${lines}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>`;
  fs.writeFileSync(filepath, `%PDF-1.4\n${content}\n%%EOF\n`);
  return { filepath, sizeBytes: fs.statSync(filepath).size };
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    // Deliberately not created here. Accounts come from registration, where
    // the password rules and the audit trail apply — the same reason seed.js
    // does not seed accounts.
    console.error(
      `No account found for ${DEMO_EMAIL}. Register it first, then re-run ` +
        `(or set DEMO_EMAIL to an account that exists).`
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Seeding demo history for ${user.name} <${user.email}>`);

  // ── The customer behind the numbers ─────────────────────────────────────────
  // A Coimbatore school teacher supporting a spouse, a child and both parents:
  // the audience this platform is built for, not a synthetic high-net-worth
  // profile that would make every recommendation trivial.
  const profileData = {
    age: 32,
    occupation: "School teacher",
    incomeRange: "6L_12L",
    city: "Coimbatore",
    state: "Tamil Nadu",
    maritalStatus: "MARRIED",
    familyMembers: 3,
    dependents: 2,
    parentsDependent: true,
    vehicleOwnership: JSON.stringify([
      { kind: "car", make: "Maruti Swift VXi", year: 2019, commercial: false },
    ]),
    propertyOwnership: JSON.stringify([
      { kind: "apartment", ownership: "OWNED", valueRange: "25L_50L" },
    ]),
    travelFrequency: "RARE",
    healthConditions: JSON.stringify([]),
    smoker: false,
    financialGoals: JSON.stringify(["CHILD_EDUCATION", "RETIREMENT"]),
    riskPreference: "BALANCED",
    insuranceHistory: JSON.stringify({ yearsHeld: 6, priorClaims: 1, lapses: 1 }),
    completeness: 85,
    source: "SELF",
  };

  const profile = await prisma.insuranceProfile.upsert({
    where: { userId: user.id },
    update: profileData,
    create: { userId: user.id, ...profileData },
  });
  console.log("  ✓ insurance profile");

  // ── What they already hold ──────────────────────────────────────────────────
  const heldPolicies = [
    {
      id: "demo-held-health-floater",
      domain: "health",
      insurer: "Aegis Insurance",
      productName: "Value Guard Family Floater",
      policyNumber: "AEG/HLT/2025/44182",
      sumInsured: 500000,
      premium: 14400,
      startDate: daysFromNow(-318),
      renewalDate: daysFromNow(47),
      external: false,
      status: "ACTIVE",
      notes: "Bought through Aegis. Covers self, spouse and child.",
    },
    {
      // The urgent one. Renewal intelligence has nothing to demonstrate
      // without a policy that is actually about to expire.
      id: "demo-held-motor-package",
      domain: "motor",
      insurer: "United India Insurance",
      productName: "Private Car Package Policy",
      policyNumber: "UII/MOT/2025/90733",
      sumInsured: 420000,
      premium: 8900,
      startDate: daysFromNow(-356),
      renewalDate: daysFromNow(9),
      external: true,
      status: "ACTIVE",
      notes: "Bought elsewhere. NCB 35% — worth carrying over at renewal.",
    },
    {
      id: "demo-held-term-life",
      domain: "life",
      insurer: "LIC of India",
      productName: "Jeevan Anand",
      policyNumber: "LIC/LIF/2021/55810",
      sumInsured: 1000000,
      premium: 21000,
      startDate: daysFromNow(-1495),
      renewalDate: daysFromNow(133),
      external: true,
      status: "ACTIVE",
      notes: "Held since 2021. Cover is low against income — a real gap to explain.",
    },
    {
      // Cover that quietly ended. The lapse is the platform's whole argument:
      // nobody explained the renewal, so the protection stopped without anyone
      // deciding that it should.
      id: "demo-held-parents-health",
      domain: "health",
      insurer: "Star Health",
      productName: "Senior Citizen Red Carpet",
      policyNumber: "STR/HLT/2024/11209",
      sumInsured: 300000,
      premium: 26800,
      startDate: daysFromNow(-712),
      renewalDate: daysFromNow(-38),
      external: true,
      status: "LAPSED",
      notes: "Parents' cover. Renewal was missed 38 days ago.",
    },
  ];

  for (const p of heldPolicies) {
    const { id, ...rest } = p;
    await prisma.heldPolicy.upsert({
      where: { id },
      update: { ...rest, profileId: profile.id },
      create: { id, profileId: profile.id, ...rest },
    });
  }
  console.log(`  ✓ ${heldPolicies.length} held policies (1 lapsed, 1 renewing in 9 days)`);

  // ── The document vault ──────────────────────────────────────────────────────
  const documents = [
    {
      id: "demo-doc-rc-book",
      filename: "vehicle-rc-book.pdf",
      title: "Vehicle Registration Certificate",
      documentKey: "rc_book",
      category: "vehicle",
      domain: "motor",
      status: "VERIFIED",
      verifiedAt: daysFromNow(-11),
      uploadedAt: daysFromNow(-12),
    },
    {
      id: "demo-doc-id-proof",
      filename: "id-proof.pdf",
      title: "Identity Proof",
      documentKey: "id_proof",
      category: "identity",
      domain: "health",
      status: "VERIFIED",
      verifiedAt: daysFromNow(-11),
      uploadedAt: daysFromNow(-12),
    },
    {
      id: "demo-doc-medical-report",
      filename: "medical-report.pdf",
      title: "Medical Report",
      documentKey: "medical_report",
      category: "medical",
      domain: "health",
      status: "PENDING_REVIEW",
      verifiedAt: null,
      uploadedAt: daysFromNow(-2),
    },
    {
      id: "demo-doc-driving-licence",
      filename: "driving-licence.pdf",
      title: "Driving Licence",
      documentKey: "driving_licence",
      category: "vehicle",
      domain: "motor",
      status: "UPLOADED",
      verifiedAt: null,
      uploadedAt: daysFromNow(-1),
    },
  ];

  for (const d of documents) {
    const { id, title, ...rest } = d;
    const { filepath, sizeBytes } = writePlaceholder(`${id}.pdf`, title);
    const row = { ...rest, filepath, sizeBytes, mimeType: "application/pdf", ownerId: user.id };
    await prisma.uploadedDocument.upsert({ where: { id }, update: row, create: { id, ...row } });
  }
  console.log(`  ✓ ${documents.length} documents (2 verified, 1 in review, 1 new)`);

  // ── What the platform has told them ─────────────────────────────────────────
  // Each one points at something else on this account, so the notifications
  // read as a platform paying attention rather than as filler.
  const notifications = [
    {
      id: "demo-notif-renewal-motor",
      type: "renewal",
      category: "RENEWAL",
      priority: "HIGH",
      title: "Your car policy renews in 9 days",
      body:
        "United India Private Car Package (UII/MOT/2025/90733) expires soon. " +
        "Your 35% no-claim bonus carries over only if you renew before it lapses.",
      deepLink: "/consumer-dashboard",
      subjectKind: "policy",
      subjectId: "demo-held-motor-package",
      isRead: false,
      status: "UNREAD",
      createdAt: daysFromNow(-1),
    },
    {
      id: "demo-notif-parents-lapsed",
      type: "renewal",
      category: "AI_SUGGESTION",
      priority: "URGENT",
      title: "Your parents' health cover has lapsed",
      body:
        "Star Health Senior Citizen Red Carpet ended 38 days ago. At their age a " +
        "fresh policy restarts the waiting period, so this is worth looking at now.",
      deepLink: "/consumer-dashboard",
      subjectKind: "policy",
      subjectId: "demo-held-parents-health",
      isRead: false,
      status: "UNREAD",
      createdAt: daysFromNow(-3),
    },
    {
      id: "demo-notif-doc-verified",
      type: "system",
      category: "DOCUMENT",
      priority: "NORMAL",
      title: "Your RC book was verified",
      body: "Vehicle registration certificate accepted. Nothing further is needed for motor cover.",
      deepLink: "/consumer-dashboard",
      subjectKind: "document",
      subjectId: "demo-doc-rc-book",
      isRead: false,
      status: "UNREAD",
      createdAt: daysFromNow(-11),
    },
    {
      id: "demo-notif-policy-issued",
      type: "system",
      category: "POLICY",
      priority: "LOW",
      title: "Family floater policy issued",
      body: "Value Guard Family Floater (AEG/HLT/2025/44182) is active. Sum insured ₹5,00,000.",
      deepLink: "/consumer-dashboard",
      subjectKind: "policy",
      subjectId: "demo-held-health-floater",
      isRead: true,
      status: "READ",
      readAt: daysFromNow(-300),
      createdAt: daysFromNow(-318),
    },
  ];

  for (const n of notifications) {
    const { id, ...rest } = n;
    await prisma.notification.upsert({
      where: { id },
      update: { ...rest, userId: user.id },
      create: { id, userId: user.id, ...rest },
    });
  }
  console.log(`  ✓ ${notifications.length} notifications (3 unread)`);

  console.log("\nDone. Nothing was deleted; re-running updates the same rows.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
