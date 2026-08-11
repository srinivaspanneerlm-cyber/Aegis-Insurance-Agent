const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Put the starting catalogue in place, and change nothing else.
 *
 * This script used to begin by deleting every user, chat, lead and document.
 * That was harmless when the database held nothing but fixtures, and became a
 * loaded gun the moment it held real ones: `npm run db:seed` is one typo away
 * from `npm run dev`, and running it would have destroyed the only
 * PLATFORM_ADMIN account — access that cannot be handed back — while leaving
 * the organisation it administers behind with nobody able to sign in.
 *
 * So it no longer deletes anything. The catalogue is written with `upsert`
 * keyed on the names below, which makes a second run a no-op rather than a
 * duplicate, and makes the script safe on a populated database as well as an
 * empty one. Seeding accounts is deliberately not its job — those are created
 * through registration and the platform's own provisioning, where the password
 * rules and audit trail apply.
 */
async function main() {
  console.log("Seeding the starting catalogue (nothing is deleted)...");

  // 1) The default underwriter. Matched on name, so re-running updates the
  //    description in place instead of creating a second company that every
  //    policy below would then have to choose between.
  const existing = await prisma.company.findFirst({
    where: { companyName: "Aegis Insurance Corp" },
  });
  const companyData = {
    companyName: "Aegis Insurance Corp",
    logo: "/company-logo.png",
    description: "Sovereign global underwriter regulated by IRDAI guidelines, featuring secure, DPDP-compliant and automated claim desks.",
  };
  const company = existing
    ? await prisma.company.update({ where: { id: existing.id }, data: companyData })
    : await prisma.company.create({ data: companyData });
  console.log(`Company ${existing ? "updated" : "created"}: ${company.companyName} (${company.id})`);

  // 3) Seed three primary policies
  const policiesData = [
    {
      policyName: "Aegis Essential Shield",
      premium: 390.0,
      coverage: "₹25 Lakh Cover",
      companyId: company.id,
    },
    {
      policyName: "Aegis Supreme Health Shield",
      premium: 850.0,
      coverage: "₹1 Crore Cover",
      companyId: company.id,
    },
    {
      policyName: "Aegis Global Elite Shield",
      premium: 2100.0,
      coverage: "₹5 Crore Cover",
      companyId: company.id,
    },
  ];

  for (const policy of policiesData) {
    // Matched on the policy name for this company, so re-running keeps one row
    // per product and refreshes its premium rather than stacking duplicates
    // that the customer would then see listed three times.
    const found = await prisma.policy.findFirst({
      where: { policyName: policy.policyName, companyId: company.id },
    });
    const saved = found
      ? await prisma.policy.update({ where: { id: found.id }, data: policy })
      : await prisma.policy.create({ data: policy });
    console.log(`Policy ${found ? "updated" : "seeded"}: ${saved.policyName} - ₹${saved.premium}`);
  }

  const users = await prisma.user.count();
  console.log(`Catalogue ready. ${users} user account(s) left untouched.`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
