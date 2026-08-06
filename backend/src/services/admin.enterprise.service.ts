/**
 * The enterprise administration surface.
 *
 * Read-heavy by design. This platform's administrators watch, investigate and
 * report; the things that *change* customer outcomes — approving a claim,
 * verifying an identity — stay with the employees who are answerable for them.
 * An admin console that could quietly approve a claim would make the human gate
 * in `employee/workflows.ts` decorative.
 */
import AppError from "../utils/appError";
import prisma from "../config/db";
import { auditService } from "./audit.service";
import { branchComparison, enterpriseOverview, resolutionTrend } from "../admin/overview";
import { aiSystemStatuses, workflowActivity, workflowCatalogue } from "../admin/aiSystems";
import { complianceFindings, complianceSummary } from "../admin/compliance";

/** Bound every list. An unbounded admin query is a production incident. */
const MAX_PAGE = 100;
const clampTake = (value: unknown, fallback = 25): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE);
};

export const enterpriseAdminService = {
  /** Everything the dashboard needs, in one call. */
  async dashboard() {
    const [overview, trend, branches, compliance, ai] = await Promise.all([
      enterpriseOverview(),
      resolutionTrend(14),
      branchComparison(),
      complianceSummary(),
      aiSystemStatuses(),
    ]);

    return {
      overview,
      trend,
      branches,
      compliance,
      // Only the headline for each system; the full picture is its own page.
      aiSystems: ai.map(({ id, name, health, activity, workload }) => ({
        id,
        name,
        health,
        activity,
        workload,
      })),
    };
  },

  /**
   * Customer records, searchable.
   *
   * Deliberately returns no conversation content. An administrator has a
   * legitimate need to see that a customer exists, what they hold and what is
   * open for them — and no need at all to read what they told an advisor in
   * confidence. That boundary is easier to keep by never selecting the column.
   */
  async customers(query: { search?: string; take?: unknown }) {
    const take = clampTake(query.take);
    const search = query.search?.trim();

    const where = {
      realm: "CUSTOMER",
      deletedAt: null,
      ...(search
        ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
        : {}),
    };

    const [total, customers] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          emailVerifiedAt: true,
          onboardedAt: true,
          isActive: true,
          _count: { select: { uploadedDocuments: true, customerWork: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    return { total, customers };
  },

  /**
   * One customer, as an administrator may see them.
   *
   * Open work, documents and sign-in history — the operational record. Still no
   * conversation content, for the same reason.
   */
  async customer(id: string) {
    const customer = await prisma.user.findFirst({
      where: { id, realm: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        onboardedAt: true,
        isActive: true,
        preferredLanguage: true,
      },
    });
    if (!customer) throw new AppError("That customer does not exist.", 404);

    const [work, documents, logins] = await Promise.all([
      prisma.workItem.findMany({
        where: { customerId: id },
        select: {
          id: true,
          reference: true,
          kind: true,
          title: true,
          status: true,
          priority: true,
          openedAt: true,
          resolvedAt: true,
        },
        orderBy: { openedAt: "desc" },
        take: 50,
      }),
      prisma.uploadedDocument.count({ where: { ownerId: id, deletedAt: null } }),
      prisma.loginEvent.findMany({
        where: { userId: id },
        select: { outcome: true, method: true, ipAddress: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return { customer, work, documents, logins };
  },

  /** The workforce: who, where, and how loaded. */
  async employees(query: { department?: string; take?: unknown }) {
    const take = clampTake(query.take, 50);
    const where = query.department ? { department: query.department } : {};

    const profiles = await prisma.employeeProfile.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        department: true,
        designation: true,
        branch: true,
        status: true,
        workloadLimit: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
      },
      orderBy: { joinedAt: "desc" },
      take,
    });

    if (profiles.length === 0) return { employees: [], departments: [] };

    // One grouped count rather than a query per person.
    const ids = profiles.map((p) => p.id);
    const [open, overdue] = await Promise.all([
      prisma.workItem.groupBy({
        by: ["assigneeId"],
        where: { assigneeId: { in: ids }, closedAt: null },
        _count: { _all: true },
      }),
      prisma.workItem.groupBy({
        by: ["assigneeId"],
        where: { assigneeId: { in: ids }, closedAt: null, dueAt: { lt: new Date() } },
        _count: { _all: true },
      }),
    ]);
    const openBy = new Map(open.map((r) => [r.assigneeId, r._count._all]));
    const overdueBy = new Map(overdue.map((r) => [r.assigneeId, r._count._all]));

    const departments = await prisma.employeeProfile.groupBy({
      by: ["department"],
      _count: { _all: true },
    });

    return {
      employees: profiles.map((profile) => ({
        ...profile,
        openWork: openBy.get(profile.id) ?? 0,
        overdue: overdueBy.get(profile.id) ?? 0,
        // Stated as a fact rather than a productivity score. Ranking people on
        // volume alone teaches an operation to close cases badly.
        trainingStatus: null,
      })),
      departments: departments.map((d) => ({ department: d.department, count: d._count._all })),
    };
  },

  /** The product catalogue. */
  async products(query: { take?: unknown }) {
    const take = clampTake(query.take, 50);
    const [companies, policies] = await Promise.all([
      prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, companyName: true, isActive: true, _count: { select: { policies: true } } },
        orderBy: { companyName: "asc" },
        take,
      }),
      prisma.policy.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          policyName: true,
          premium: true,
          coverage: true,
          isActive: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { companyName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take,
      }),
    ]);

    return {
      companies,
      policies,
      // `version` increments on write but no prior states are kept, so there is
      // no history to show. Saying so beats an empty tab labelled History.
      versionHistory: {
        available: false,
        reason: "Products carry a version number but previous versions are not retained.",
        needs: "A product revision table written on every change.",
      },
    };
  },

  /** Claims, as an operations view. */
  async claims() {
    const [byStatus, byPriority, recent, resolved] = await Promise.all([
      prisma.workItem.groupBy({ by: ["status"], where: { kind: "CLAIM" }, _count: { _all: true } }),
      prisma.workItem.groupBy({ by: ["priority"], where: { kind: "CLAIM", closedAt: null }, _count: { _all: true } }),
      prisma.workItem.findMany({
        where: { kind: "CLAIM" },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          priority: true,
          openedAt: true,
          dueAt: true,
          resolvedAt: true,
        },
        orderBy: { openedAt: "desc" },
        take: 50,
      }),
      prisma.workItem.findMany({
        where: { kind: "CLAIM", resolvedAt: { not: null } },
        select: { openedAt: true, resolvedAt: true },
        take: 500,
      }),
    ]);

    const durations = resolved
      .filter((c) => c.resolvedAt)
      .map((c) => (c.resolvedAt as Date).getTime() - c.openedAt.getTime());

    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count._all])),
      averageProcessingHours: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000)
        : null,
      recent,
      fraudIndicators: {
        available: false,
        reason: "Risk analysis runs inside the claim workflow but does not persist a score.",
        needs: "A stored risk score and reason on the risk_analysis step.",
      },
    };
  },

  /** The audit trail, filterable. Read-only by construction — it is append-only. */
  async auditLog(query: { action?: string; actorId?: string; take?: unknown }) {
    const take = clampTake(query.take, 50);
    const where = {
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [total, entries, actions] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take }),
      prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { _count: { action: "desc" } }, take: 20 }),
    ]);

    return {
      total,
      entries,
      actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
    };
  },

  /** Sign-in security events, which live in their own trail. */
  async securityEvents(query: { take?: unknown }) {
    const take = clampTake(query.take, 50);
    const [recent, byOutcome] = await Promise.all([
      prisma.loginEvent.findMany({ orderBy: { createdAt: "desc" }, take }),
      prisma.loginEvent.groupBy({ by: ["outcome"], _count: { _all: true } }),
    ]);
    return {
      recent,
      byOutcome: Object.fromEntries(byOutcome.map((r) => [r.outcome, r._count._all])),
    };
  },

  aiSystems: () => aiSystemStatuses(),
  workflows: async () => ({ catalogue: workflowCatalogue(), activity: await workflowActivity() }),
  compliance: async () => ({
    summary: await complianceSummary(),
    findings: await complianceFindings(),
  }),
  analytics: async () => ({
    overview: await enterpriseOverview(),
    trend: await resolutionTrend(30),
    branches: await branchComparison(),
  }),

  /**
   * A report, as rows.
   *
   * Returned as data rather than a rendered file, so the same figures serve the
   * screen, the CSV and any future format without three implementations that
   * can disagree about what "this month" means.
   */
  async report(kind: string, actorId: string) {
    const generators: Record<string, () => Promise<{ title: string; rows: Record<string, unknown>[] }>> = {
      operations: async () => {
        const overview = await enterpriseOverview();
        return {
          title: "Operations summary",
          rows: [
            { metric: "Customers", value: overview.customers.value.total },
            { metric: "New customers this week", value: overview.customers.value.newThisWeek },
            { metric: "Active employees", value: overview.employees.value.active },
            { metric: "Active policies", value: overview.policies.value.active },
            { metric: "Open cases", value: overview.claims.value.open },
            { metric: "Overdue cases", value: overview.claims.value.overdue },
            { metric: "Average resolution (hours)", value: overview.claims.value.averageResolutionHours ?? "n/a" },
            { metric: "Documents held", value: overview.documents.value.total },
          ],
        };
      },
      compliance: async () => {
        const findings = await complianceFindings();
        return {
          title: "Compliance findings",
          rows: findings.map((f) => ({
            check: f.title,
            severity: f.severity,
            affected: f.count,
            status: f.count === 0 ? "PASS" : "FAIL",
            remedy: f.remedy,
          })),
        };
      },
      branches: async () => ({
        title: "Branch comparison",
        rows: (await branchComparison()) as unknown as Record<string, unknown>[],
      }),
    };

    const generate = generators[kind];
    if (!generate) throw new AppError("Unknown report.", 400, "UNKNOWN_REPORT");

    const report = await generate();
    // Reports leave the platform. Who generated which one, and when, is exactly
    // the sort of thing an auditor asks about afterwards.
    auditService.record({
      actorId,
      action: "admin.report.generated",
      metadata: { report: kind, rows: report.rows.length },
    });

    return { kind, ...report, generatedAt: new Date().toISOString() };
  },
};

/**
 * Rows to CSV.
 *
 * Every field is quoted and internal quotes are doubled. Unquoted CSV breaks on
 * the first comma in a remedy sentence, and a report that silently loses a
 * column is worse than one that fails to generate.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const escape = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}
