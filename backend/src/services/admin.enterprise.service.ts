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
import { assessWorkload } from "../employee/operationsManager";
import { aiSystemStatuses, workflowActivity, workflowCatalogue } from "../admin/aiSystems";
import { PERMISSIONS, permissionsForRole } from "../auth/permissions";
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
  async dashboard(organizationId: string) {
    const [overview, trend, branches, compliance, ai] = await Promise.all([
      enterpriseOverview(organizationId),
      resolutionTrend(organizationId, 14),
      branchComparison(organizationId),
      complianceSummary(organizationId),
      aiSystemStatuses(organizationId),
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
   * The tenant's own record.
   *
   * Read-only, and that is the design rather than a shortfall: plan, seats,
   * status and archival belong to whoever operates the platform, not to the
   * tenant subject to them. A console where an organisation could grant itself
   * seats or lift its own suspension would make the licence decorative.
   *
   * Seat usage counts staff, not customers — the same rule the platform applies
   * when it refuses to cut seats below the accounts that exist.
   */
  async organization(organizationId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        emailDomains: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
        archivedAt: true,
        license: {
          select: { plan: true, seats: true, startsAt: true, expiresAt: true, updatedAt: true },
        },
      },
    });
    // The scope came from the session, so this can only fail if the record was
    // removed mid-session — which is worth saying plainly rather than 500ing.
    if (!organization) throw new AppError("That organisation no longer exists.", 404);

    const [seatsInUse, customers] = await Promise.all([
      prisma.user.count({
        where: { organizationId, realm: { in: ["EMPLOYEE", "ENTERPRISE"] }, deletedAt: null },
      }),
      prisma.user.count({ where: { organizationId, realm: "CUSTOMER", deletedAt: null } }),
    ]);

    return {
      organization,
      seats: organization.license
        ? { used: seatsInUse, total: organization.license.seats }
        : // No licence row means nothing has been issued, which is different
          // from a licence with zero seats.
          { available: false as const, used: seatsInUse, reason: "No licence has been issued to this organisation." },
      customers,
      // Everything here is set by the platform operator. Saying so beats a
      // screen of fields that silently refuse to save.
      editable: {
        available: false as const,
        reason: "Plan, seats, status and contact details are managed by the platform operator.",
        needs: "A tenant-facing route that may write the fields an organisation is allowed to change.",
      },
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
  async customers(organizationId: string, query: { search?: string; take?: unknown }) {
    const take = clampTake(query.take);
    const search = query.search?.trim();

    const where = {
      organizationId,
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
  async customer(organizationId: string, id: string) {
    const customer = await prisma.user.findFirst({
      // The tenant is part of the lookup, not a check after it: a customer
      // belonging to another organisation is "not found" here, which is the
      // right answer and leaks nothing about whether the id exists.
      where: { id, organizationId, realm: "CUSTOMER" },
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
        where: { customerId: id, organizationId },
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
      prisma.uploadedDocument.count({ where: { ownerId: id, organizationId, deletedAt: null } }),
      // LoginEvent has no organisation of its own; the customer above has
      // already been proven to belong to this tenant, so scoping by their id
      // is the scope.
      prisma.loginEvent.findMany({
        where: { userId: id },
        // The id is selected so a list can key on it: two sign-ins can share a
        // timestamp, and an array index is not a stable identity.
        select: { id: true, outcome: true, method: true, ipAddress: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return { customer, work, documents, logins };
  },

  /** The workforce: who, where, and how loaded. */
  async employees(organizationId: string, query: { department?: string; take?: unknown }) {
    const take = clampTake(query.take, 50);
    const where = { organizationId, ...(query.department ? { department: query.department } : {}) };

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

    // The department counts are org-wide on purpose: they are the filter's own
    // controls, so they must survive a filter that matches nothing. Without
    // them the chips unmount and an administrator who filtered into an empty
    // department has no way back to everyone but reloading the page.
    const departments = await prisma.employeeProfile.groupBy({
      by: ["department"],
      where: { organizationId },
      _count: { _all: true },
    });
    const departmentCounts = departments.map((d) => ({ department: d.department, count: d._count._all }));

    // An empty result is still a shape. Returning early without `capacity` left
    // the console reading `capacity.activeStaff` off undefined, which is a blank
    // screen for every tenant that has not hired anybody yet.
    if (profiles.length === 0) {
      return {
        employees: [],
        departments: departmentCounts,
        capacity: {
          activeStaff: 0,
          totalCapacity: 0,
          openWork: 0,
          // Null, not 0% — an operation with no staff has no utilisation, and
          // 0% reads as plenty of room.
          utilisation: null,
          stretched: 0,
        },
      };
    }

    // One grouped count rather than a query per person.
    const ids = profiles.map((p) => p.id);
    const [open, overdue] = await Promise.all([
      prisma.workItem.groupBy({
        by: ["assigneeId"],
        where: { assigneeId: { in: ids }, organizationId, closedAt: null },
        _count: { _all: true },
      }),
      prisma.workItem.groupBy({
        by: ["assigneeId"],
        where: { assigneeId: { in: ids }, organizationId, closedAt: null, dueAt: { lt: new Date() } },
        _count: { _all: true },
      }),
    ]);
    const openBy = new Map(open.map((r) => [r.assigneeId, r._count._all]));
    const overdueBy = new Map(overdue.map((r) => [r.assigneeId, r._count._all]));

    const employees = profiles.map((profile) => {
      const openWork = openBy.get(profile.id) ?? 0;
      const overdue = overdueBy.get(profile.id) ?? 0;
      // The same judgement the employee portal shows each person about
      // themselves, not a second opinion invented for administrators.
      const workload = assessWorkload({
        employeeId: profile.id,
        openCount: openWork,
        workloadLimit: profile.workloadLimit,
        overdueCount: overdue,
      });
      return {
        ...profile,
        openWork,
        overdue,
        workload,
        // Stated as a fact rather than a productivity score. Ranking people on
        // volume alone teaches an operation to close cases badly.
        trainingStatus: null,
      };
    });

    // Whether the operation as a whole has room — the figure that decides
    // whether to hire, which no per-person row answers.
    const active = employees.filter((e) => e.status === "ACTIVE");
    const capacity = active.reduce((sum, e) => sum + e.workloadLimit, 0);
    const carried = active.reduce((sum, e) => sum + e.openWork, 0);

    return {
      employees,
      departments: departmentCounts,
      capacity: {
        activeStaff: active.length,
        totalCapacity: capacity,
        openWork: carried,
        // Null rather than 0% when nobody is active: an operation with no staff
        // has no utilisation, and 0% reads as plenty of room.
        utilisation: capacity === 0 ? null : Math.round((carried / capacity) * 100),
        stretched: active.filter(
          (e) => e.workload.verdict === "AT_CAPACITY" || e.workload.verdict === "OVERLOADED"
        ).length,
      },
    };
  },

  /** The product catalogue. */
  async products(organizationId: string, query: { take?: unknown }) {
    const take = clampTake(query.take, 50);
    const [companies, policies] = await Promise.all([
      // Insurers are shared reference data — "HDFC Ergo" is not owned by a
      // tenant — so the company list is not scoped. The catalogue below is.
      prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, companyName: true, isActive: true, _count: { select: { policies: true } } },
        orderBy: { companyName: "asc" },
        take,
      }),
      prisma.policy.findMany({
        where: { organizationId, deletedAt: null },
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

  /**
   * The book: policies customers actually hold.
   *
   * Distinct from the catalogue, which is what the tenant offers. The split
   * that matters here is `external` — cover the customer declared they hold
   * elsewhere counts as cover, and counting it as this tenant's book would
   * overstate the business by however many policies their customers bought
   * from somebody else. Both are reported, separately.
   */
  async policies(organizationId: string, query: { status?: string; take?: unknown }) {
    const take = clampTake(query.take, 50);
    const where = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };

    const soon = new Date(Date.now() + 90 * 86_400_000);

    const [total, byStatus, sold, held, renewingSoon, policies] = await Promise.all([
      prisma.heldPolicy.count({ where: { organizationId } }),
      prisma.heldPolicy.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
      prisma.heldPolicy.count({ where: { organizationId, external: false } }),
      prisma.heldPolicy.count({ where: { organizationId, external: true } }),
      prisma.heldPolicy.count({
        where: { organizationId, status: "ACTIVE", renewalDate: { gte: new Date(), lte: soon } },
      }),
      prisma.heldPolicy.findMany({
        where,
        select: {
          id: true,
          domain: true,
          insurer: true,
          productName: true,
          policyNumber: true,
          sumInsured: true,
          premium: true,
          startDate: true,
          renewalDate: true,
          external: true,
          status: true,
          profile: { select: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { renewalDate: "asc" },
        take,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      sold,
      held,
      renewingSoon,
      policies,
      // Premium is stored per policy, but nothing records what was actually
      // collected — so a book value would be a list price, not revenue.
      bookValue: {
        available: false as const,
        reason: "Policies carry a premium figure, but no payment is ever recorded against one.",
        needs: "A payment or collection record linked to the held policy.",
      },
    };
  },

  /** Claims, as an operations view. */
  async claims(organizationId: string) {
    const [byStatus, byPriority, recent, resolved] = await Promise.all([
      prisma.workItem.groupBy({ by: ["status"], where: { organizationId, kind: "CLAIM" }, _count: { _all: true } }),
      prisma.workItem.groupBy({ by: ["priority"], where: { organizationId, kind: "CLAIM", closedAt: null }, _count: { _all: true } }),
      prisma.workItem.findMany({
        where: { organizationId, kind: "CLAIM" },
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
        where: { organizationId, kind: "CLAIM", resolvedAt: { not: null } },
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

  /**
   * Renewals, from both places they live.
   *
   * A renewal work item is one somebody has raised. A held policy with a
   * renewal date approaching is one nobody has noticed yet, and those are
   * precisely the ones that lapse — so a screen showing only the queue would
   * show the work and hide the risk.
   */
  async renewals(organizationId: string) {
    const now = new Date();
    const in30 = new Date(Date.now() + 30 * 86_400_000);
    const in90 = new Date(Date.now() + 90 * 86_400_000);

    const [raised, byStatus, overdue, next30, next90, upcoming] = await Promise.all([
      prisma.workItem.count({ where: { organizationId, kind: "RENEWAL", closedAt: null } }),
      prisma.workItem.groupBy({
        by: ["status"],
        where: { organizationId, kind: "RENEWAL" },
        _count: { _all: true },
      }),
      prisma.heldPolicy.count({
        where: { organizationId, status: "ACTIVE", renewalDate: { lt: now } },
      }),
      prisma.heldPolicy.count({
        where: { organizationId, status: "ACTIVE", renewalDate: { gte: now, lte: in30 } },
      }),
      prisma.heldPolicy.count({
        where: { organizationId, status: "ACTIVE", renewalDate: { gt: in30, lte: in90 } },
      }),
      prisma.heldPolicy.findMany({
        where: { organizationId, status: "ACTIVE", renewalDate: { gte: now, lte: in90 } },
        select: {
          id: true,
          domain: true,
          insurer: true,
          productName: true,
          premium: true,
          renewalDate: true,
          external: true,
          profile: { select: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { renewalDate: "asc" },
        take: 50,
      }),
    ]);

    return {
      raised,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      overdue,
      next30,
      next90,
      upcoming,
      // Whether a renewal actually completed is not recorded anywhere: a lapsed
      // policy and one renewed elsewhere look identical in this data.
      renewalRate: {
        available: false as const,
        reason: "Nothing records whether a policy was renewed, lapsed, or moved to another insurer.",
        needs: "An outcome written onto the policy when its renewal date passes.",
      },
    };
  },

  /**
   * Documents and identity checks.
   *
   * Verification counts come from the document's own status; KYC counts from the
   * work items that carry the check. They are reported side by side and not
   * added together — a KYC case can span several documents, and one document
   * can settle none of them on its own.
   */
  async documents(organizationId: string) {
    const [byStatus, unowned, kycByStatus, kycOverdue, recent] = await Promise.all([
      prisma.uploadedDocument.groupBy({
        by: ["status"],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.uploadedDocument.count({
        where: { organizationId, deletedAt: null, ownerId: null },
      }),
      prisma.workItem.groupBy({
        by: ["status"],
        where: { organizationId, kind: "KYC" },
        _count: { _all: true },
      }),
      prisma.workItem.count({
        where: { organizationId, kind: "KYC", closedAt: null, dueAt: { lt: new Date() } },
      }),
      prisma.uploadedDocument.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          filename: true,
          documentKey: true,
          domain: true,
          status: true,
          uploadedAt: true,
          verifiedAt: true,
          rejectionReason: true,
          owner: { select: { id: true, name: true } },
        },
        orderBy: { uploadedAt: "desc" },
        take: 50,
      }),
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      unowned,
      kycByStatus: Object.fromEntries(kycByStatus.map((r) => [r.status, r._count._all])),
      kycOverdue,
      recent,
      // The document platform stores an extraction blob but never records
      // whether a machine or a person produced the verdict.
      automatedVerification: {
        available: false as const,
        reason: "Documents record who verified them and when, but not whether any check was automated.",
        needs: "A verification method written alongside the verdict.",
      },
    };
  },

  /**
   * Customer intelligence, for one tenant.
   *
   * Counted here rather than through intelligenceAnalytics.service, which is
   * deliberately global — it serves the employee portal, where scoping it would
   * change a screen this phase must not touch. These are counts over rows that
   * now carry an organisation, not a second implementation of the scoring: no
   * recommendation is computed here, only how many exist and how complete the
   * profiles behind them are.
   */
  async intelligence(organizationId: string) {
    const [profiles, runs, withPolicies, completeness, byKind, recent] = await Promise.all([
      prisma.insuranceProfile.count({ where: { organizationId } }),
      prisma.intelligenceRun.count({ where: { organizationId } }),
      prisma.heldPolicy.count({ where: { organizationId } }),
      prisma.insuranceProfile.aggregate({
        where: { organizationId },
        _avg: { completeness: true },
      }),
      prisma.intelligenceRun.groupBy({
        by: ["kind"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.intelligenceRun.findMany({
        where: { organizationId },
        select: {
          id: true,
          kind: true,
          confidence: true,
          engineVersion: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    // Who the advised customers actually are.
    //
    // Totals say how many can be advised; they say nothing about whom this
    // tenant serves, which is the substance of customer intelligence for a
    // platform aimed at people insurance usually underserves. Grouped rather
    // than listed — an administrator has a legitimate need for the shape of the
    // book and none for an individual's circumstances.
    //
    // Counted here rather than through intelligenceAnalytics.service, which is
    // global by design because the employee portal reads it.
    const cohortOf = async (by: "incomeRange" | "riskPreference" | "city") => {
      const rows = await prisma.insuranceProfile.groupBy({
        by: [by],
        where: { organizationId },
        _count: { _all: true },
      });
      return rows
        .map((r) => ({ value: (r as Record<string, unknown>)[by] as string | null, count: r._count._all }))
        .filter((r) => r.value !== null && r.value !== "")
        .sort((a, b) => b.count - a.count)
        .slice(0, 8) as { value: string; count: number }[];
    };

    const [byIncome, byRisk, byCity, withDependents, smokers] = await Promise.all([
      cohortOf("incomeRange"),
      cohortOf("riskPreference"),
      cohortOf("city"),
      prisma.insuranceProfile.count({ where: { organizationId, dependents: { gt: 0 } } }),
      prisma.insuranceProfile.count({ where: { organizationId, smoker: true } }),
    ]);

    // A customer with no profile cannot be advised at all, which is the number
    // worth acting on rather than the average.
    const customers = await prisma.user.count({
      where: { organizationId, realm: "CUSTOMER", deletedAt: null },
    });

    return {
      customers,
      profiles,
      withoutProfile: Math.max(0, customers - profiles),
      runs,
      withPolicies,
      averageCompleteness:
        completeness._avg.completeness === null ? null : Math.round(completeness._avg.completeness),
      byKind: Object.fromEntries(byKind.map((r) => [r.kind, r._count._all])),
      cohorts: {
        byIncome,
        byRisk,
        byCity,
        withDependents,
        smokers,
        // Every cohort is over profiles that exist, not over customers. A
        // tenant whose customers mostly have no profile would otherwise read
        // these as describing their whole book.
        basis: profiles,
      },
      recent,
      // Whether advice was taken is not recorded: nothing links a
      // recommendation to a policy that followed it.
      adviceOutcome: {
        available: false as const,
        reason: "Nothing links a recommendation to a policy bought after it.",
        needs: "A recommendation reference written onto the held policy when cover is taken.",
      },
    };
  },

  /**
   * Support: complaints and appointments.
   *
   * Complaints are counted apart from appointments because they mean opposite
   * things — one is somebody unhappy, the other is a booking — and a combined
   * "support volume" would hide a rising complaint rate behind a busy diary.
   */
  async support(organizationId: string) {
    const [complaintsByStatus, appointmentsByStatus, overdue, recent] = await Promise.all([
      prisma.workItem.groupBy({
        by: ["status"],
        where: { organizationId, kind: "COMPLAINT" },
        _count: { _all: true },
      }),
      prisma.workItem.groupBy({
        by: ["status"],
        where: { organizationId, kind: "APPOINTMENT" },
        _count: { _all: true },
      }),
      prisma.workItem.count({
        where: {
          organizationId,
          kind: { in: ["COMPLAINT", "APPOINTMENT"] },
          closedAt: null,
          dueAt: { lt: new Date() },
        },
      }),
      prisma.workItem.findMany({
        where: { organizationId, kind: { in: ["COMPLAINT", "APPOINTMENT"] } },
        select: {
          id: true,
          kind: true,
          reference: true,
          title: true,
          status: true,
          priority: true,
          openedAt: true,
          dueAt: true,
          resolvedAt: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { openedAt: "desc" },
        take: 50,
      }),
    ]);

    return {
      complaints: Object.fromEntries(complaintsByStatus.map((r) => [r.status, r._count._all])),
      appointments: Object.fromEntries(appointmentsByStatus.map((r) => [r.status, r._count._all])),
      overdue,
      recent,
      // No satisfaction signal is captured anywhere in the platform.
      satisfaction: {
        available: false as const,
        reason: "Nothing asks a customer how a complaint was handled.",
        needs: "A response captured when a complaint is resolved.",
      },
    };
  },

  /**
   * What the platform has been sending this tenant's people.
   *
   * Notification rows carry no organisation of their own, so the boundary is the
   * recipient's membership.
   */
  async notifications(organizationId: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const scope = { user: { organizationId } };

    const [byCategory, byStatus, unread, recentAnnouncements] = await Promise.all([
      prisma.notification.groupBy({
        by: ["category"],
        where: { ...scope, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.notification.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
      prisma.notification.count({ where: { ...scope, status: "UNREAD" } }),
      prisma.announcement.findMany({
        select: {
          id: true,
          title: true,
          body: true,
          publishedAt: true,
          audienceRealm: true,
          audienceDepartment: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      windowDays: 30,
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r._count._all])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      unread,
      announcements: recentAnnouncements,
      // Announcements are platform-wide and carry no organisation, so this list
      // is not filtered by tenant — said rather than implied.
      announcementScope: {
        available: false as const,
        reason: "Announcements are published platform-wide and carry no organisation.",
        needs: "An organisation on the announcement, or an audience that names one.",
      },
    };
  },

  /**
   * Who holds what, across this tenant's staff.
   *
   * The permission model itself is code, not data — this reports the roles in
   * use and what each one may do, so an administrator can see the shape of
   * access without a route that could change it. Granting a role is not done
   * from here; it would need a write path this console deliberately lacks.
   */
  async roles(organizationId: string) {
    const staff = await prisma.user.groupBy({
      by: ["role"],
      where: { organizationId, realm: { in: ["EMPLOYEE", "ENTERPRISE"] }, deletedAt: null },
      _count: { _all: true },
    });

    return {
      roles: staff.map((r) => ({
        role: r.role,
        holders: r._count._all,
        permissions: permissionsForRole(r.role),
      })),
      allPermissions: [...PERMISSIONS],
      assignable: {
        available: false as const,
        reason: "Roles are granted through account administration, not from this console.",
        needs: "A staff-management route that may change a role, with its own audit trail.",
      },
    };
  },

  /** The audit trail, filterable. Read-only by construction — it is append-only. */
  async auditLog(organizationId: string, query: { action?: string; actorId?: string; take?: unknown }) {
    const take = clampTake(query.take, 50);
    // AuditLog carries no organisation of its own, so the tenant boundary is
    // the actor's membership. Entries written by the platform itself (actorId
    // null) are deliberately excluded from a tenant's view — they are not that
    // tenant's record to read.
    const where = {
      actor: { organizationId },
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [total, rows, actions] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          action: true,
          actorId: true,
          entity: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.groupBy({ by: ["action"], where, _count: { _all: true }, orderBy: { _count: { action: "desc" } }, take: 20 }),
    ]);

    // Who, by name. The trail stored an id and the console showed neither, so
    // an audit record answered what happened and not who did it — half a record.
    // One query for the page rather than a join per row, the same shape
    // activityFeed already uses.
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(actors.map((a) => [a.id, a]));

    // Who has been acting, so "everything this person did" is one click rather
    // than a guessed id. Ranked by volume, capped like the action list.
    const actorCounts = new Map<string, number>();
    for (const r of rows) if (r.actorId) actorCounts.set(r.actorId, (actorCounts.get(r.actorId) ?? 0) + 1);

    return {
      total,
      entries: rows.map((r) => ({
        ...r,
        // An actor outside this tenant cannot appear — the scope is their
        // membership — so an unresolved id means the account was deleted.
        actorName: r.actorId ? (byId.get(r.actorId)?.name ?? "a removed account") : "the platform",
        actorEmail: r.actorId ? (byId.get(r.actorId)?.email ?? null) : null,
      })),
      actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
      actors: [...actorCounts.entries()]
        .map(([id, count]) => ({ id, name: byId.get(id)?.name ?? "a removed account", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  },

  /**
   * Sign-in security, for one tenant.
   *
   * Three things, and the second is the point. A list of failures is data; a
   * count of failures against one account from one address is a finding, and
   * nobody reads twenty rows to arrive at it themselves.
   *
   * No score and no green badge: nothing in this codebase defines what a
   * "healthy" failure rate is, and inventing a threshold would dress a guess as
   * a measurement.
   */
  async securityEvents(organizationId: string, query: { take?: unknown }) {
    const take = clampTake(query.take, 50);
    const scope = { user: { organizationId } };
    const dayAgo = new Date(Date.now() - 86_400_000);

    const [recent, byOutcome, failures, sessions] = await Promise.all([
      // Same shape as the audit trail: the event belongs to whoever signed in.
      prisma.loginEvent.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          outcome: true,
          method: true,
          realm: true,
          email: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.loginEvent.groupBy({ by: ["outcome"], where: scope, _count: { _all: true } }),
      // The last day only. A cluster from three months ago is history, not an
      // alert, and mixing them would bury the one that matters.
      prisma.loginEvent.findMany({
        where: { ...scope, outcome: { not: "SUCCESS" }, createdAt: { gte: dayAgo } },
        select: { email: true, ipAddress: true, createdAt: true },
        take: 500,
      }),
      // AuthSession had no query in this service at all, so a tenant could not
      // see who currently holds a session — the first question an administrator
      // asks after a run of failures.
      prisma.authSession.findMany({
        where: { ...scope, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
        take: 50,
        select: {
          id: true,
          realm: true,
          ipAddress: true,
          deviceLabel: true,
          trustedAt: true,
          lastSeenAt: true,
          createdAt: true,
          expiresAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    // Grouped by the pair, because either alone is noise: one person mistyping
    // a password all morning is not the same as one address trying many
    // accounts, and the pair separates them.
    const clusters = new Map<string, { email: string; ipAddress: string | null; count: number; latest: Date }>();
    for (const f of failures) {
      const key = `${f.email}|${f.ipAddress ?? ""}`;
      const seen = clusters.get(key);
      if (seen) {
        seen.count += 1;
        if (f.createdAt > seen.latest) seen.latest = f.createdAt;
      } else {
        clusters.set(key, { email: f.email, ipAddress: f.ipAddress, count: 1, latest: f.createdAt });
      }
    }

    return {
      recent,
      byOutcome: Object.fromEntries(byOutcome.map((r) => [r.outcome, r._count._all])),
      clusters: [...clusters.values()]
        .filter((c) => c.count > 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      failuresLastDay: failures.length,
      sessions,
    };
  },

  aiSystems: (organizationId: string) => aiSystemStatuses(organizationId),
  workflows: async (organizationId: string) => ({
    catalogue: workflowCatalogue(),
    activity: await workflowActivity(organizationId),
  }),
  compliance: async (organizationId: string) => ({
    summary: await complianceSummary(organizationId),
    findings: await complianceFindings(organizationId),
  }),
  analytics: async (organizationId: string) => ({
    overview: await enterpriseOverview(organizationId),
    trend: await resolutionTrend(organizationId, 30),
    branches: await branchComparison(organizationId),
  }),

  /**
   * A report, as rows.
   *
   * Returned as data rather than a rendered file, so the same figures serve the
   * screen, the CSV and any future format without three implementations that
   * can disagree about what "this month" means.
   */
  async report(organizationId: string, kind: string, actorId: string) {
    const generators: Record<string, () => Promise<{ title: string; rows: Record<string, unknown>[] }>> = {
      operations: async () => {
        const overview = await enterpriseOverview(organizationId);
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
        const findings = await complianceFindings(organizationId);
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
        rows: (await branchComparison(organizationId)) as unknown as Record<string, unknown>[],
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
