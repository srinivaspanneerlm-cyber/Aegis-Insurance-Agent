/**
 * The Employee Operations Manager.
 *
 * A department head's judgement, written as rules rather than prose: who should
 * pick this up, how urgent is it, who is overloaded, and what needs escalating
 * before it breaches.
 *
 * It is deliberately deterministic. Task distribution is the kind of decision
 * people ask "why did I get this one" about, and a rule can answer that while a
 * generation cannot. The assistant advises *inside* a case; the manager decides
 * *between* cases, and those want different machinery.
 *
 * Nothing here touches the customer-facing multi-agent engine in `ai-python/`.
 * That system is protected, it serves a different audience, and the coupling
 * this module would need to it does not exist yet — see `assistant.ts` for the
 * seam where it will.
 */
import type { WorkflowDefinition } from "./workflows";

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const WORK_KINDS = [
  "CLAIM",
  "KYC",
  "RENEWAL",
  "COMPLAINT",
  "APPOINTMENT",
  "TASK",
] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/**
 * How long each kind of work has, in minutes, at normal priority.
 *
 * A claim is slower than a complaint on purpose: a complaint left unanswered
 * compounds, while a claim rushed is a claim decided badly. These are the
 * promises the analytics measure against.
 */
const BASE_SLA_MINUTES: Record<WorkKind, number> = {
  CLAIM: 48 * 60,
  KYC: 24 * 60,
  RENEWAL: 72 * 60,
  COMPLAINT: 8 * 60,
  APPOINTMENT: 4 * 60,
  TASK: 24 * 60,
};

/** Priority compresses the promise rather than replacing it. */
const PRIORITY_FACTOR: Record<Priority, number> = {
  LOW: 2,
  NORMAL: 1,
  HIGH: 0.5,
  URGENT: 0.25,
};

export function slaMinutesFor(kind: WorkKind, priority: Priority): number {
  return Math.round(BASE_SLA_MINUTES[kind] * PRIORITY_FACTOR[priority]);
}

export const dueAtFor = (kind: WorkKind, priority: Priority, from = new Date()): Date =>
  new Date(from.getTime() + slaMinutesFor(kind, priority) * 60_000);

/**
 * Which department owns which kind of work.
 *
 * Routing by department rather than by person is what lets somebody go on
 * leave without their queue becoming unreachable.
 */
const DEPARTMENT_FOR_KIND: Record<WorkKind, string> = {
  CLAIM: "claims",
  KYC: "operations",
  RENEWAL: "servicing",
  COMPLAINT: "support",
  APPOINTMENT: "servicing",
  TASK: "operations",
};

export const departmentFor = (kind: WorkKind): string => DEPARTMENT_FOR_KIND[kind];

export interface Candidate {
  readonly id: string;
  readonly department: string;
  readonly status: string;
  readonly workloadLimit: number;
  /** How much open work they already hold. */
  readonly openCount: number;
}

export interface RoutingDecision {
  readonly assigneeId: string | null;
  /** Why — shown to a team lead, and recorded on the work item's timeline. */
  readonly reason: string;
}

/**
 * Choose who picks this up.
 *
 * Least-loaded within the owning department, and nobody over their limit. Not
 * round-robin: round-robin distributes *count* evenly and workload unevenly,
 * because it keeps handing work to whoever is already buried.
 *
 * Returning `null` rather than assigning anyway is the important case. An
 * over-capacity department needs a team lead to see it, and quietly pushing one
 * more item onto the least-drowning person is how that stays invisible until
 * something breaches.
 */
export function routeWork(kind: WorkKind, candidates: readonly Candidate[]): RoutingDecision {
  const department = departmentFor(kind);
  const available = candidates.filter(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.department === department &&
      candidate.openCount < candidate.workloadLimit
  );

  if (available.length === 0) {
    const inDepartment = candidates.filter((c) => c.department === department);
    return {
      assigneeId: null,
      reason:
        inDepartment.length === 0
          ? `No active member of the ${department} team is available.`
          : `Every member of the ${department} team is at their workload limit.`,
    };
  }

  const chosen = available.reduce((best, candidate) =>
    candidate.openCount < best.openCount ? candidate : best
  );

  return {
    assigneeId: chosen.id,
    reason: `Least loaded in ${department} — ${chosen.openCount} of ${chosen.workloadLimit} open.`,
  };
}

export interface WorkloadSnapshot {
  readonly employeeId: string;
  readonly openCount: number;
  readonly workloadLimit: number;
  readonly overdueCount: number;
}

export type WorkloadVerdict = "HEALTHY" | "BUSY" | "AT_CAPACITY" | "OVERLOADED";

/**
 * How somebody's queue is doing.
 *
 * Overdue work is weighted separately from volume, because thirty items none of
 * which are late is a productive day, while five items all late is somebody
 * stuck — and a single "count" would rate the first as the worse one.
 */
export function assessWorkload(snapshot: WorkloadSnapshot): {
  verdict: WorkloadVerdict;
  utilisation: number;
  advice: string;
} {
  const utilisation = snapshot.workloadLimit
    ? snapshot.openCount / snapshot.workloadLimit
    : 0;

  if (snapshot.overdueCount >= 5 || utilisation > 1) {
    return {
      verdict: "OVERLOADED",
      utilisation,
      advice: "Re-assign the oldest items, or raise this with the team lead.",
    };
  }
  if (utilisation >= 1) {
    return {
      verdict: "AT_CAPACITY",
      utilisation,
      advice: "No new work should be routed here until something closes.",
    };
  }
  if (utilisation >= 0.75 || snapshot.overdueCount > 0) {
    return {
      verdict: "BUSY",
      utilisation,
      advice: snapshot.overdueCount
        ? "Clear the overdue items first — they are the ones being measured."
        : "Approaching capacity.",
    };
  }
  return { verdict: "HEALTHY", utilisation, advice: "Capacity available for more work." };
}

export interface EscalationInput {
  readonly id: string;
  readonly priority: Priority;
  readonly dueAt: Date | null;
  readonly status: string;
  readonly assigneeId: string | null;
  readonly definition?: WorkflowDefinition | null;
}

export interface Escalation {
  readonly workItemId: string;
  /** BREACHED | AT_RISK | UNASSIGNED | STALLED */
  readonly reason: string;
  readonly detail: string;
}

/**
 * What a team lead needs to look at now.
 *
 * "At risk" is deliberately raised before the promise is broken — an escalation
 * that only fires on breach is a report, not an escalation. The window is a
 * quarter of the remaining time, so an urgent item warns sooner in absolute
 * terms than a routine one, which is the behaviour a person would expect
 * without being told.
 */
export function findEscalations(items: readonly EscalationInput[], now = new Date()): Escalation[] {
  const escalations: Escalation[] = [];

  for (const item of items) {
    if (item.status === "RESOLVED" || item.status === "CLOSED" || item.status === "CANCELLED") {
      continue;
    }

    if (!item.assigneeId) {
      escalations.push({
        workItemId: item.id,
        reason: "UNASSIGNED",
        detail: "Nobody owns this. It will not be worked until somebody does.",
      });
      continue;
    }

    if (!item.dueAt) continue;

    const remaining = item.dueAt.getTime() - now.getTime();
    if (remaining <= 0) {
      escalations.push({
        workItemId: item.id,
        reason: "BREACHED",
        detail: `Past its due time by ${formatDuration(-remaining)}.`,
      });
    } else if (remaining <= slaMinutesFor("TASK", item.priority) * 60_000 * 0.25) {
      escalations.push({
        workItemId: item.id,
        reason: "AT_RISK",
        detail: `Due in ${formatDuration(remaining)}.`,
      });
    }
  }

  // Most urgent first, so a lead reading top-down is reading in the right order.
  const rank = { BREACHED: 0, AT_RISK: 1, UNASSIGNED: 2, STALLED: 3 } as Record<string, number>;
  return escalations.sort((a, b) => (rank[a.reason] ?? 9) - (rank[b.reason] ?? 9));
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
