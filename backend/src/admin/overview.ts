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
 * Bounds on the two reads here that return rows rather than counts.
 *
 * An unbounded admin query is a production incident waiting for the tenant that
 * grows large enough to trigger it — the dashboard would stay fast for every
 * customer until the day it did not, on the account that mattered most.
 *
 * Both are far above any real tenant on this platform, so they cost nothing
 * today; they exist so the failure mode is a slightly narrower figure rather
 * than a page that never loads.
 */
const MAX_RESOLVED_SAMPLE = 5_000;
const MAX_STAFF = 5_000;

/**
 * Everything the dashboard needs, in one round trip.
 *
 * Assembled with `Promise.all` rather than sequentially — this is the first
 * screen an administrator sees, and twelve serial queries would be a visible
 * wait on every load.
 */
/**
 * Every figure on this page belongs to one tenant.
 *
 * Insurers are the exception — shared reference data, counted whole — and
 * `authSession` / `loginEvent` / `auditLog` carry no organisation of their own,
 * so they are scoped through the user they belong to.
 */
export async function enterpriseOverview(organizationId: string) {
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
    prisma.user.count({ where: { organizationId, realm: "CUSTOMER", deletedAt: null } }),
    prisma.user.count({ where: { organizationId, realm: "CUSTOMER", createdAt: { gte: weekAgo } } }),
    prisma.employeeProfile.count({ where: { organizationId } }),
    prisma.employeeProfile.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.policy.count({ where: { organizationId, isActive: true, deletedAt: null } }),
    prisma.company.count({ where: { isActive: true, deletedAt: null } }),
    prisma.workItem.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    prisma.workItem.groupBy({ by: ["kind"], where: { organizationId }, _count: { _all: true } }),
    // Newest first, so a tenant large enough to reach the cap gets the most
    // recent work rather than an arbitrary slice of the month.
    prisma.workItem.findMany({
      where: { organizationId, resolvedAt: { gte: monthAgo } },
      select: { openedAt: true, resolvedAt: true, kind: true },
      orderBy: { resolvedAt: "desc" },
      take: MAX_RESOLVED_SAMPLE,
    }),
    prisma.workItem.count({ where: { organizationId, closedAt: null, dueAt: { lt: new Date() } } }),
    prisma.uploadedDocument.count({ where: { organizationId, deletedAt: null } }),
    prisma.uploadedDocument.count({ where: { organizationId, uploadedAt: { gte: weekAgo } } }),
    prisma.authSession.count({ where: { user: { organizationId }, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.loginEvent.count({
      where: { user: { organizationId }, createdAt: { gte: today }, outcome: { not: "SUCCESS" } },
    }),
    prisma.auditLog.count({ where: { actor: { organizationId }, createdAt: { gte: today } } }),
    prisma.user.count({ where: { organizationId, realm: "CUSTOMER", emailVerifiedAt: null, deletedAt: null } }),
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
      // How many cases the average is over. A mean with no denominator invites
      // being read as the whole month's, and once the sample is capped that
      // reading is wrong — so the figure carries its own basis.
      averageResolutionBasis: durations.length,
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
export async function resolutionTrend(organizationId: string, days = 14) {
  const from = daysAgo(days);
  const resolved = await prisma.workItem.findMany({
    where: { organizationId, resolvedAt: { gte: from } },
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
export async function branchComparison(organizationId: string) {
  const profiles = await prisma.employeeProfile.findMany({
    where: { organizationId },
    select: { id: true, branch: true, department: true, status: true },
    take: MAX_STAFF,
  });
  if (profiles.length === 0) return [];

  // Neither count depends on the other, so they wait together. Awaiting them in
  // turn made a three-query function take three round trips.
  const [open, overdue] = await Promise.all([
    prisma.workItem.groupBy({
      by: ["assigneeId"],
      where: { organizationId, closedAt: null },
      _count: { _all: true },
    }),
    prisma.workItem.groupBy({
      by: ["assigneeId"],
      where: { organizationId, closedAt: null, dueAt: { lt: new Date() } },
      _count: { _all: true },
    }),
  ]);

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
