/**
 * Compliance checks, run against what the platform actually holds.
 *
 * Each check answers a question an auditor would ask, from real rows. None of
 * them is a claim of IRDAI certification — that is a matter of audit and
 * licensing, not of software asserting it about itself, and a dashboard that
 * printed "IRDAI compliant" would be the single most dangerous thing in this
 * product.
 *
 * What this does is narrower and genuinely useful: it finds the things that
 * would fail an audit, while there is still time to fix them.
 */
import prisma from "../config/db";
import { WORKFLOW_DEFINITIONS, workflowSpec } from "../employee/workflows";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

export interface ComplianceFinding {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  /** How many records are affected. Zero means the check passed. */
  readonly count: number;
  readonly detail: string;
  /** What to do about it, concretely. */
  readonly remedy: string;
  /**
   * Which records are affected, up to a handful.
   *
   * A count is unactionable alone: "3 decisions completed without a person"
   * cannot be investigated without knowing which three. Capped, because a
   * finding listing four hundred references is a report rather than a finding
   * — `count` remains the true total.
   */
  readonly evidence?: readonly { label: string; id: string }[];
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60_000);

/**
 * Run every check.
 *
 * Ordered by severity so the first thing an administrator reads is the thing
 * that matters most, rather than whichever query happened to be written first.
 */
/**
 * Compliance findings for one tenant.
 *
 * `workflowStep`, `authSession` and `uploadedDocument`-without-an-owner are
 * scoped through the record they hang off, since none carries an organisation
 * of its own. An unowned document has no owner to scope through, so it is
 * matched on its own organisation column instead.
 */
export async function complianceFindings(organizationId: string): Promise<ComplianceFinding[]> {
  const [
    unverifiedStaff,
    staleOpenWork,
    workWithoutOwner,
    approvedWithoutHuman,
    orphanedDocuments,
    inactiveWithLiveSessions,
    lockedAccounts,
    staffWithoutProfile,
  ] = await Promise.all([
    // Staff realms require a verified address to sign in; one that slipped
    // through is a provisioning error worth catching.
    prisma.user.count({
      where: { organizationId, realm: { in: ["EMPLOYEE", "ENTERPRISE", "PLATFORM"] }, emailVerifiedAt: null },
    }),
    prisma.workItem.count({ where: { organizationId, closedAt: null, openedAt: { lt: daysAgo(30) } } }),
    prisma.workItem.count({ where: { organizationId, closedAt: null, assigneeId: null } }),
    // The one that would actually fail an audit: a completed run whose decision
    // step was not completed by a person.
    prisma.workflowStep.count({
      where: {
        run: { workItem: { organizationId } },
        key: decisionStepKeys(),
        status: "COMPLETED",
        actorKind: { not: "EMPLOYEE" },
      },
    }),
    // Documents carry no verification field, so "unreviewed" cannot be
    // measured — see the not-instrumented note on the overview. What *is*
    // measurable, and matters more: a document with no owner cannot be served
    // to the person it belongs to, and cannot be deleted when they ask.
    prisma.uploadedDocument.count({ where: { organizationId, deletedAt: null, ownerId: null } }),
    prisma.authSession.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() }, user: { organizationId, isActive: false } },
    }),
    prisma.user.count({ where: { organizationId, lockedUntil: { gt: new Date() } } }),
    prisma.user.count({ where: { organizationId, realm: "EMPLOYEE", employeeProfile: null } }),
  ]);

  // The references behind the counts. Only these three name identifiable
  // records; the rest count a condition, and inventing a reference for those
  // would be worse than the count alone.
  const [staleRefs, unownedRefs, decisionRefs] = await Promise.all([
    prisma.workItem.findMany({
      where: { organizationId, closedAt: null, openedAt: { lt: daysAgo(30) } },
      select: { id: true, reference: true },
      orderBy: { openedAt: "asc" },
      take: 5,
    }),
    prisma.workItem.findMany({
      where: { organizationId, closedAt: null, assigneeId: null },
      select: { id: true, reference: true },
      orderBy: { openedAt: "asc" },
      take: 5,
    }),
    prisma.workflowStep.findMany({
      where: {
        run: { workItem: { organizationId } },
        key: decisionStepKeys(),
        status: "COMPLETED",
        actorKind: { not: "EMPLOYEE" },
      },
      select: { run: { select: { workItem: { select: { id: true, reference: true } } } } },
      take: 5,
    }),
  ]);

  const refs = (rows: { id: string; reference: string }[]) =>
    rows.map((r) => ({ label: r.reference, id: r.id }));


  const findings: ComplianceFinding[] = [
    {
      id: "decision-without-person",
      title: "Decisions completed without a person",
      severity: "CRITICAL",
      count: approvedWithoutHuman,
      detail:
        "A workflow step requiring a human decision was completed by something other than an employee. The platform is built to make this impossible; a non-zero count means an invariant has been breached.",
      remedy: "Investigate immediately. Every affected case needs re-review by a named person.",
      evidence: refs(decisionRefs.map((d) => d.run.workItem)),
    },
    {
      id: "live-session-inactive-account",
      title: "Live sessions on deactivated accounts",
      severity: "CRITICAL",
      count: inactiveWithLiveSessions,
      detail:
        "An account marked inactive still has a session that has not been revoked. Deactivation should end access, not merely prevent the next sign-in.",
      remedy: "Revoke these sessions, then make deactivation revoke sessions as part of the same operation.",
    },
    {
      id: "staff-unverified-email",
      title: "Staff accounts with an unverified address",
      severity: "HIGH",
      count: unverifiedStaff,
      detail:
        "Staff realms require a verified email to sign in. An unverified staff account is either unusable or evidence that the check was bypassed at provisioning.",
      remedy: "Re-send verification, or remove the account if it was created in error.",
    },
    {
      id: "work-without-owner",
      title: "Open work with nobody assigned",
      severity: "HIGH",
      count: workWithoutOwner,
      detail:
        "Nobody owns these cases, so nobody is working them and no promise is being measured against them.",
      remedy: "Assign them, or raise the department's workload limits so routing can place them.",
      evidence: refs(unownedRefs),
    },
    {
      id: "stale-open-work",
      title: "Open more than 30 days",
      severity: "MEDIUM",
      count: staleOpenWork,
      detail: "Cases open for over a month, whatever their due time. These are what an audit samples.",
      remedy: "Review and either progress or close with a reason.",
      evidence: refs(staleRefs),
    },
    {
      id: "orphaned-documents",
      title: "Documents with no owner",
      severity: "MEDIUM",
      count: orphanedDocuments,
      detail:
        "Uploaded documents not attached to any account. They cannot be shown to the person they belong to, and they cannot be deleted when that person asks — which is a data-protection obligation, not a housekeeping one.",
      remedy: "Attach them to the right account, or delete them if the owner cannot be established.",
    },
    {
      id: "locked-accounts",
      title: "Accounts currently locked out",
      severity: "INFO",
      count: lockedAccounts,
      detail:
        "Accounts locked by repeated failed sign-ins. Ordinary in small numbers; a spike is worth looking at.",
      remedy: "No action needed unless the number is unusual — locks expire on their own.",
    },
    {
      id: "employee-without-profile",
      title: "Employee accounts without a profile",
      severity: "INFO",
      count: staffWithoutProfile,
      detail: "They can sign in but cannot be routed work, because there is no department or branch.",
      remedy: "Complete provisioning, or move the account to the correct realm.",
    },
  ];

  const rank: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 };
  return findings.sort((a, b) => {
    // Failing checks first within a severity — a passing CRITICAL is good news
    // and should not sit above a failing HIGH.
    const aFails = a.count > 0 ? 0 : 1;
    const bFails = b.count > 0 ? 0 : 1;
    if (aFails !== bFails) return aFails - bFails;
    return rank[a.severity] - rank[b.severity];
  });
}

/**
 * Prisma has no "where this row's key is in a code-defined set" clause, so the
 * decision-step keys are gathered from the workflow definitions themselves.
 * Reading them from the same module the engine runs means this check cannot
 * drift from the processes it is auditing.
 */
function decisionStepKeys() {
  const keys = WORKFLOW_DEFINITIONS.flatMap((definition) =>
    workflowSpec(definition)
      .steps.filter((step) => step.requiresDecision)
      .map((step) => step.key)
  );
  return { in: [...new Set(keys)] };
}

/**
 * The headline, from findings already in hand.
 *
 * Separated from the query so a caller that needs both — the compliance page
 * shows the verdict above the list it summarises — runs the eleven checks once
 * instead of twice. Pure, so the two can never disagree about the same set.
 */
export function summariseFindings(findings: readonly ComplianceFinding[]) {
  const failing = findings.filter((f) => f.count > 0);
  const critical = failing.filter((f) => f.severity === "CRITICAL");
  const high = failing.filter((f) => f.severity === "HIGH");

  return {
    checksRun: findings.length,
    passing: findings.length - failing.length,
    failing: failing.length,
    critical: critical.length,
    high: high.length,
    verdict:
      critical.length > 0
        ? ("ACTION_REQUIRED" as const)
        : high.length > 0
          ? ("ATTENTION" as const)
          : ("CLEAR" as const),
    // Said explicitly, because the alternative reading is dangerous.
    disclaimer:
      "These are the platform's own checks against its own records. They are not a statement of IRDAI compliance, which is a matter of audit and licensing.",
  };
}

/** A single headline for the dashboard: are we audit-ready right now? */
export async function complianceSummary(organizationId: string) {
  return summariseFindings(await complianceFindings(organizationId));
}
