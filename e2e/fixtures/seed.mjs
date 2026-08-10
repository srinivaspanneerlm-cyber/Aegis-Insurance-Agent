/**
 * The tenant an end-to-end run signs in as.
 *
 * Written into a throwaway SQLite file that exists only for the run — never the
 * development database. A browser test drives the whole product, so a seed that
 * shared a database with real work would eventually delete something somebody
 * cared about, and the failure would look like a bug rather than a test.
 *
 * The data is deliberately shaped so the assertions can be exact: one employee,
 * one branch, one insurer, a known number of products. A test asserting "some
 * number appears" passes against a blank screen.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Prisma and bcrypt belong to the backend workspace, not to this one.
 *
 * Resolved from there rather than added as dependencies here, so the fixture
 * cannot drift onto a different client version than the server it is seeding
 * for — two Prisma clients against one schema is a debugging afternoon nobody
 * enjoys.
 */
const backendRequire = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "backend", "package.json")
);
const { PrismaClient } = backendRequire("@prisma/client");
const bcrypt = backendRequire("bcrypt");

export const ADMIN = {
  name: "E2E Administrator",
  email: "e2e-admin@aegis.test",
  password: "e2e-correct-horse-battery",
};

export const TENANT = {
  name: "E2E Assurance Ltd",
  branch: "Madurai",
  insurer: "E2E Mutual",
  /** Products this tenant sells from that insurer. The screen must show this. */
  products: 2,
};

export async function seed(databaseUrl) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  const org = await prisma.organization.create({
    data: { slug: "e2e-assurance", name: TENANT.name, status: "ACTIVE" },
  });
  await prisma.license.create({
    data: { organizationId: org.id, plan: "TRIAL", seats: 5, startsAt: new Date() },
  });

  // The password is hashed by the same library the application uses, rather
  // than a hash pasted in here — a fixture that hashes differently to the
  // product tests the fixture.
  const admin = await prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      password: await bcrypt.hash(ADMIN.password, 10),
      realm: "ENTERPRISE",
      role: "ENTERPRISE_ADMIN",
      organizationId: org.id,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: "E2E Officer",
      email: "e2e-officer@aegis.test",
      password: await bcrypt.hash(ADMIN.password, 10),
      realm: "EMPLOYEE",
      role: "EMPLOYEE",
      organizationId: org.id,
      emailVerifiedAt: new Date(),
    },
  });
  const profile = await prisma.employeeProfile.create({
    data: {
      userId: staff.id,
      organizationId: org.id,
      employeeCode: "E2E-1",
      department: "CLAIMS",
      designation: "Officer",
      branch: TENANT.branch,
      status: "ACTIVE",
      workloadLimit: 10,
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "E2E Customer",
      email: "e2e-customer@aegis.test",
      password: await bcrypt.hash(ADMIN.password, 10),
      realm: "CUSTOMER",
      role: "CUSTOMER",
      organizationId: org.id,
    },
  });

  // One insurer, two products from it. The products screen shows this count and
  // must show *this tenant's* two rather than the platform's — the leak closed
  // in Phase 5 task 12.
  const insurer = await prisma.company.create({ data: { companyName: TENANT.insurer } });
  for (let i = 0; i < TENANT.products; i += 1) {
    await prisma.policy.create({
      data: {
        policyName: `E2E Cover ${i + 1}`,
        premium: 1000 + i,
        coverage: "e2e",
        companyId: insurer.id,
        organizationId: org.id,
      },
    });
  }

  // A second tenant selling the same insurer, so "this tenant's count" is a
  // claim the screen can actually get wrong.
  const other = await prisma.organization.create({
    data: { slug: "e2e-other", name: "E2E Rival Ltd", status: "ACTIVE" },
  });
  await prisma.policy.create({
    data: {
      policyName: "Rival Cover",
      premium: 999,
      coverage: "e2e",
      companyId: insurer.id,
      organizationId: other.id,
    },
  });

  // Resolved work, so the dashboard's average resolution is a number rather
  // than a dash — the figure task 11 gave a stated basis.
  for (let i = 0; i < 4; i += 1) {
    const openedAt = new Date(Date.now() - (i + 2) * 3_600_000);
    await prisma.workItem.create({
      data: {
        organizationId: org.id,
        reference: `E2E-CLM-${i}`,
        kind: "CLAIM",
        title: `E2E claim ${i}`,
        status: "RESOLVED",
        priority: "MEDIUM",
        openedAt,
        resolvedAt: new Date(openedAt.getTime() + 7_200_000),
        assigneeId: profile.id,
        customerId: customer.id,
      },
    });
  }

  await prisma.$disconnect();
  return { organizationId: org.id, adminId: admin.id };
}
