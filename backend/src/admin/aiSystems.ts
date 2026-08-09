/**
 * The AI Orchestration Centre — observability, not control.
 *
 * An administrator watching this page can see how the platform's AI is
 * behaving. They cannot change a model, a prompt or a routing rule from here,
 * and that is deliberate rather than unfinished: the customer-facing engine is
 * the part of this product that is hardest to reason about and most expensive
 * to get wrong, and a console that lets somebody retune it between board
 * meetings is how it stops being reviewable.
 *
 * Every number below comes from a table the platform already writes to. Where a
 * signal genuinely is not recorded — token cost, model latency — it says so
 * rather than estimating, because an estimate on an operations dashboard gets
 * treated as a measurement within a week.
 */
import prisma from "../config/db";
import { WORKFLOW_DEFINITIONS, workflowSpec } from "../employee/workflows";

export type SystemHealth = "HEALTHY" | "DEGRADED" | "IDLE" | "NOT_INSTRUMENTED";

export interface AiSystemStatus {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  /** Who it serves. Administrators need to know whose experience is affected. */
  readonly audience: string;
  readonly health: SystemHealth;
  /** Work handled in the window. Null where the system records no activity. */
  readonly activity: number | null;
  readonly successRate: number | null;
  readonly errorRate: number | null;
  /** What is in flight right now. */
  readonly workload: number | null;
  readonly lastActivityAt: string | null;
  /** Stated plainly where a figure is absent. */
  readonly notes: string;
  /** Administrators may configure these; never the model itself. */
  readonly configurable: readonly string[];
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60_000);

/**
 * Health from activity and failure, in that order.
 *
 * "Idle" is separated from "healthy" on purpose. A system with no traffic is
 * not a system that is working — reporting it green is how an outage goes
 * unnoticed over a quiet weekend.
 */
function healthFrom(activity: number, errors: number): SystemHealth {
  if (activity === 0) return "IDLE";
  const errorRate = errors / activity;
  return errorRate > 0.1 ? "DEGRADED" : "HEALTHY";
}

const rate = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

/**
 * Every AI system on the platform, with what the platform knows about it.
 *
 * The window is seven days: long enough that a quiet Sunday does not read as an
 * outage, short enough that last month's incident does not still colour it.
 */
/**
 * AI activity for one tenant.
 *
 * The systems themselves are shared platform infrastructure, but the *activity*
 * counted here is somebody's customers talking to them, so every count is
 * scoped. Chat, Session, AgentTransfer and RecommendationHistory hang off a
 * user; workflow steps and events hang off a work item.
 */
export async function aiSystemStatuses(
  /**
   * The tenant to count, or `null` for the whole platform.
   *
   * Explicit rather than optional: the platform console legitimately reads
   * every tenant, and an argument that may be omitted is one that gets omitted
   * by accident from a tenant-facing caller.
   */
  organizationId: string | null
): Promise<AiSystemStatus[]> {
  // The three shapes the tenant boundary takes here: records that hang off a
  // user, off a work item, and work items themselves.
  const byUser = organizationId ? { user: { organizationId } } : {};
  const byWorkItem = organizationId ? { workItem: { organizationId } } : {};
  const byRun = organizationId ? { run: { workItem: { organizationId } } } : {};
  const byOwn = organizationId ? { organizationId } : {};
  const since = daysAgo(7);

  const [
    customerMessages,
    customerSessions,
    liveCustomerSessions,
    lastCustomerChat,
    transfers,
    recommendations,
    lastRecommendation,
    assistantSteps,
    assistantStepsCompleted,
    lastAssistantStep,
    routedWork,
    unroutedWork,
    escalatedEvents,
  ] = await Promise.all([
    prisma.chat.count({ where: { ...byUser, createdAt: { gte: since } } }),
    prisma.session.count({ where: { ...byUser, startedAt: { gte: since } } }),
    prisma.session.count({ where: { ...byUser, status: "active" } }),
    prisma.chat.findFirst({ where: byUser, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    // AgentTransfer hangs off a Session, not a user, so the tenant boundary is
    // one relation further out.
    prisma.agentTransfer.count({
      where: {
        ...(organizationId ? { session: { user: { organizationId } } } : {}),
        createdAt: { gte: since },
      },
    }),
    prisma.recommendationHistory.count({ where: { user: { organizationId }, createdAt: { gte: since } } }),
    prisma.recommendationHistory.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.workflowStep.count({ where: { ...byRun, createdAt: { gte: since }, actorKind: "ASSISTANT" } }),
    prisma.workflowStep.count({
      where: {
        ...byRun,
        createdAt: { gte: since },
        actorKind: "ASSISTANT",
        status: "COMPLETED",
      },
    }),
    prisma.workflowStep.findFirst({
      where: { ...byRun, actorKind: "ASSISTANT" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    prisma.workItem.count({ where: { ...byOwn, openedAt: { gte: since }, assigneeId: { not: null } } }),
    prisma.workItem.count({ where: { ...byOwn, openedAt: { gte: since }, assigneeId: null } }),
    prisma.workItemEvent.count({ where: { ...byWorkItem, createdAt: { gte: since }, kind: "ESCALATED" } }),
  ]);

  const routingTotal = routedWork + unroutedWork;

  return [
    {
      id: "customer-ai",
      name: "Customer AI",
      purpose: "Explains cover, compares products and answers customers in their own language.",
      audience: "Customers",
      health: healthFrom(customerMessages, 0),
      activity: customerMessages,
      // A transfer is a hand-off, not a failure — so it is reported as its own
      // figure rather than folded into an error rate it would distort.
      successRate: null,
      errorRate: null,
      workload: liveCustomerSessions,
      lastActivityAt: lastCustomerChat?.createdAt.toISOString() ?? null,
      notes: `${customerSessions} conversations in the last 7 days, ${transfers} hand-offs between domains. Success and error rates are not instrumented — the engine does not record per-turn outcomes.`,
      configurable: ["Rate limits", "Enabled domains", "Session retention"],
    },
    {
      id: "employee-assistant",
      name: "Employee Assistant",
      purpose: "Validates documents, analyses risk and drafts recommendations inside cases.",
      audience: "Employees",
      health: healthFrom(assistantSteps, assistantSteps - assistantStepsCompleted),
      activity: assistantSteps,
      successRate: rate(assistantStepsCompleted, assistantSteps),
      errorRate: rate(assistantSteps - assistantStepsCompleted, assistantSteps),
      workload: assistantSteps - assistantStepsCompleted,
      lastActivityAt: lastAssistantStep?.completedAt?.toISOString() ?? null,
      notes:
        "Owns named steps in every workflow. Structurally barred from completing a decision step — a person always decides.",
      configurable: ["Which steps it owns", "Escalation thresholds"],
    },
    {
      id: "operations-manager",
      name: "Employee Operations Manager",
      purpose: "Routes work, assigns priority, watches workload and raises escalations.",
      audience: "Employees and team leads",
      health: healthFrom(routingTotal, unroutedWork),
      activity: routingTotal,
      successRate: rate(routedWork, routingTotal),
      errorRate: rate(unroutedWork, routingTotal),
      workload: unroutedWork,
      lastActivityAt: null,
      notes:
        unroutedWork > 0
          ? `${unroutedWork} item(s) could not be routed — every candidate department was at capacity. ${escalatedEvents} escalation(s) raised.`
          : `Everything routed successfully. ${escalatedEvents} escalation(s) raised.`,
      configurable: ["Workload limits", "SLA targets", "Department routing"],
    },
    {
      id: "recommendation-engine",
      name: "Recommendation Engine",
      purpose: "Scores and compares insurance products against a customer's circumstances.",
      audience: "Customers",
      health: healthFrom(recommendations, 0),
      activity: recommendations,
      successRate: null,
      errorRate: null,
      workload: null,
      lastActivityAt: lastRecommendation?.createdAt.toISOString() ?? null,
      notes: `${recommendations} recommendation(s) produced in the last 7 days.`,
      configurable: ["Scoring weights", "Product availability"],
    },
    {
      id: "analytics-agent",
      name: "Analytics Agent",
      purpose: "Business intelligence, trend analysis and anomaly detection over operations data.",
      audience: "Administrators",
      health: "HEALTHY",
      activity: null,
      successRate: null,
      errorRate: null,
      workload: null,
      lastActivityAt: null,
      notes:
        "Runs deterministically over recorded operations data — see the Analytics and Compliance pages. Predictive forecasting is not implemented; the platform has too little history to forecast honestly.",
      configurable: ["Reporting windows", "Anomaly thresholds"],
    },
    {
      id: "executive-agent",
      name: "Executive Agent",
      purpose: "Coordinates enterprise priorities and produces executive summaries.",
      audience: "Administrators",
      health: "HEALTHY",
      activity: null,
      successRate: null,
      errorRate: null,
      workload: null,
      lastActivityAt: null,
      notes:
        "Governance layer over the systems above. Its summaries are derived from recorded figures; it holds no language model and issues no instructions to other systems.",
      configurable: ["Summary cadence", "Alert thresholds"],
    },
  ];
}

/**
 * The workflow catalogue as an administrator sees it — every definition the
 * platform runs, with which steps a machine owns and which a person must.
 *
 * Read from the same module the workflows actually execute, so this cannot
 * describe a process the platform is not running.
 */
export function workflowCatalogue() {
  return WORKFLOW_DEFINITIONS.map((definition) => {
    const spec = workflowSpec(definition);
    return {
      definition,
      label: spec.label,
      kind: spec.kind,
      totalSteps: spec.steps.length,
      humanSteps: spec.steps.filter((s) => s.actorKind === "EMPLOYEE").length,
      decisionSteps: spec.steps.filter((s) => s.requiresDecision).length,
      steps: spec.steps.map((step) => ({
        key: step.key,
        name: step.name,
        description: step.description,
        actorKind: step.actorKind,
        requiresDecision: Boolean(step.requiresDecision),
        permission: step.permission ?? null,
      })),
    };
  });
}

/** How many runs of each workflow are in flight, and how they have ended. */
export async function workflowActivity(organizationId: string) {
  const [byDefinition, byStatus] = await Promise.all([
    prisma.workflowRun.groupBy({ by: ["definition", "status"], where: { workItem: { organizationId } }, _count: { _all: true } }),
    prisma.workflowRun.groupBy({ by: ["status"], where: { workItem: { organizationId } }, _count: { _all: true } }),
  ]);

  return {
    byDefinition: byDefinition.map((row) => ({
      definition: row.definition,
      status: row.status,
      count: row._count._all,
    })),
    totals: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
  };
}
