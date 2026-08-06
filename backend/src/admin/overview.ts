/**
 * The enterprise picture, assembled from what the platform actually records.
 *
 * Every figure here is derived from a real table. Where the platform does not
 * capture something an executive would reasonably ask for — revenue actually
 * collected, customer satisfaction, fraud signals — this returns an explicit
 * "not instrumented" marker naming what would have to be captured, rather than
 * a number.
 *
 * That is a deliberate product decision, not a gap left by accident. A
 * dashboard that invents a satisfaction score is worse than one that admits it
 * has none: the invented one gets quoted in a board pack.
 */
import prisma from "../config/db";

/**
 * A figure the platform cannot yet produce.
 *
 * Carries what would need to exist, so the gap is actionable rather than
 * merely apologetic.
 */
export interface NotInstrumented {
  readonly available: false;
  readonly reason: string;
  /** What the platform would have to start recording. */
  readonly needs: string;
}

export interface Measured<T> {
  readonly available: true;
  readonly value: T;
}

export type Metric<T> = Measured<T> | NotInstrumented;

const measured = <T>(value: T): Measured<T> => ({ available: true, value });
const missing = (reason: string, needs: string): NotInstrumented => ({
  available: false,
  reason,
  needs,
});

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60_000);

/**
 * Everything the dashboard needs, in one round trip.
 *
 * Assembled with `Promise.all` rather than sequentially — this is the first
 * screen an administrator sees, and twelve serial queries would be a visible
 * wait on every load.
 */
export async function enterpriseOverview() {
  const today = startOfDay();
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);

  const [
    customers,
    newCustomersThisWeek,
    employees,
    activeEmployees,
    policies,
    companies,
    workByStatus,
    workByKind,
    resolvedLastMonth,
    overdueWork,
    documents,
    documentsThisWeek,
    liveSessions,
    failedLoginsToday,
    auditEventsToday,
    unverifiedCustomers,
  ] = await Promise.all([
    prisma.user.count({ where: { realm: "CUSTOMER", deletedAt: null } }),
    prisma.user.count({ where: { realm: "CUSTOMER", createdAt: { gte: weekAgo } } }),
    prisma.employeeProfile.count(),
    prisma.employeeProfile.count({ where: { status: "ACTIVE" } }),
    prisma.policy.count({ where: { isActive: true, deletedAt: null } }),
    prisma.company.count({ where: { isActive: true, deletedAt: null } }),
    prisma.workItem.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.workItem.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.workItem.findMany({
      where: { resolvedAt: { gte: monthAgo } },
      select: { openedAt: true, resolvedAt: true, kind: true },
    }),
    prisma.workItem.count({ where: { closedAt: null, dueAt: { lt: new Date() } } }),
    prisma.uploadedDocument.count({ where: { deletedAt: null } }),
    prisma.uploadedDocument.count({ where: { uploadedAt: { gte: weekAgo } } }),
    prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.loginEvent.count({
      where: { createdAt: { gte: today }, outcome: { not: "SUCCESS" } },
    }),
    prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { realm: "CUSTOMER", emailVerifiedAt: null, deletedAt: null } }),
  ]);

  const byStatus = Object.fromEntries(workByStatus.map((r) => [r.status, r._count._all]));
  const byKind = Object.fromEntries(workByKind.map((r) => [r.kind, r._count._all]));

  const durations = resolvedLastMonth
    .filter((w) => w.resolvedAt)
    .map((w) => (w.resolvedAt as Date).getTime() - w.openedAt.getTime());
  const averageResolutionHours = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000)
    : null;

  const openWork = (byStatus.OPEN ?? 0) + (byStatus.IN_PROGRESS ?? 0) + (byStatus.AWAITING_APPROVAL ?? 0);

  return {
    generatedAt: new Date().toISOString(),

    customers: measured({ total: customers, newThisWeek: newCustomersThisWeek, unverified: unverifiedCustomers }),
    employees: measured({ total: employees, active: activeEmployees }),
    policies: measured({ active: policies, insurers: companies }),

    claims: measured({
      total: byKind.CLAIM ?? 0,
      open: openWork,
      resolved: byStatus.RESOLVED ?? 0,
      closed: byStatus.CLOSED ?? 0,
      overdue: overdueWork,
      averageResolutionHours,
    }),

    renewals: measured({ total: byKind.RENEWAL ?? 0 }),
    kyc: measured({ total: byKind.KYC ?? 0 }),
    complaints: measured({ total: byKind.COMPLAINT ?? 0 }),

    documents: measured({ total: documents, thisWeek: documentsThisWeek }),

    system: measured({
      liveSessions,
      failedLoginsToday,
      auditEventsToday,
    }),

    // ── Not instrumented ──────────────────────────────────────────────────────
    // Named individually rather than hidden, so the gap is a backlog item and
    // not a surprise in a board meeting.
    revenue: missing(
      "The platform records list premiums on products, but no transactions.",
      "A payment or policy-issuance record with an amount and a date."
    ),
    customerSatisfaction: missing(
      "Nothing asks customers how they found the service.",
      "A post-resolution survey, or a rating captured when a case closes."
    ),
    fraudSignals: missing(
      "Risk analysis runs inside claim workflows but does not persist a score.",
      "A stored risk score and reason on the claim's risk_analysis step."
    ),
    documentVerification: missing(
      "Documents record who uploaded them and when, but not whether anybody checked them.",
      "A verifiedAt timestamp and verifier on UploadedDocument."
    ),
  };
}

/**
 * Work resolved per day, for the dashboard's trend line.
 *
 * Grouped in application code rather than SQL because this schema targets both
 * SQLite and Postgres, and date bucketing is where their dialects diverge most
 * sharply. The window is bounded, so the cost is a few hundred rows.
 */
export async function resolutionTrend(days = 14) {
  const from = daysAgo(days);
  const resolved = await prisma.workItem.findMany({
    where: { resolvedAt: { gte: from } },
    select: { resolvedAt: true, kind: true },
    take: 5000,
  });

  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(daysAgo(i).toISOString().slice(0, 10), 0);
  }
  for (const item of resolved) {
    if (!item.resolvedAt) continue;
    const key = item.resolvedAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

/**
 * How each branch is doing.
 *
 * Real, because `EmployeeProfile.branch` is real. Compares open load and
 * overdue count rather than a productivity score — a score would need a
 * quality signal the platform does not capture, and ranking people on volume
 * alone is how an operation learns to close cases badly.
 */
export async function branchComparison() {
  const profiles = await prisma.employeeProfile.findMany({
    select: { id: true, branch: true, department: true, status: true },
  });
  if (profiles.length === 0) return [];

  const open = await prisma.workItem.groupBy({
    by: ["assigneeId"],
    where: { closedAt: null },
    _count: { _all: true },
  });
  const overdue = await prisma.workItem.groupBy({
    by: ["assigneeId"],
    where: { closedAt: null, dueAt: { lt: new Date() } },
    _count: { _all: true },
  });

  const openBy = new Map(open.map((r) => [r.assigneeId, r._count._all]));
  const overdueBy = new Map(overdue.map((r) => [r.assigneeId, r._count._all]));

  const branches = new Map<
    string,
    { branch: string; employees: number; active: number; openWork: number; overdue: number }
  >();

  for (const profile of profiles) {
    const row = branches.get(profile.branch) ?? {
      branch: profile.branch,
      employees: 0,
      active: 0,
      openWork: 0,
      overdue: 0,
    };
    row.employees += 1;
    if (profile.status === "ACTIVE") row.active += 1;
    row.openWork += openBy.get(profile.id) ?? 0;
    row.overdue += overdueBy.get(profile.id) ?? 0;
    branches.set(profile.branch, row);
  }

  return [...branches.values()].sort((a, b) => b.overdue - a.overdue);
}
