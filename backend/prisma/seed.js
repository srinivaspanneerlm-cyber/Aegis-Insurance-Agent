const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // 1) Clear existing data to prevent duplicate keys or clutter during tests
  await prisma.policy.deleteMany();
  await prisma.company.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.uploadedDocument.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database cleared successfully.");

  // 2) Seed a default Company
  const company = await prisma.company.create({
    data: {
      companyName: "Aegis Insurance Corp",
      logo: "/company-logo.png",
      description: "Sovereign global underwriter regulated by IRDAI guidelines, featuring secure, DPDP-compliant and automated claim desks.",
    },
  });
  console.log(`Company created: ${company.companyName} (${company.id})`);

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
    const createdPolicy = await prisma.policy.create({
      data: policy,
    });
    console.log(`Policy seeded: ${createdPolicy.policyName} - ₹${createdPolicy.premium}`);
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
