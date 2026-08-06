/**
 * Employee operations.
 *
 * Two rules run through everything here and neither is negotiable:
 *
 *  1. **Scope before capability.** An employee reads their own queue; reading
 *     everybody's is a separate capability a team lead holds. The narrower path
 *     is the default, so forgetting to scope produces "no results" rather than
 *     "every customer's claim".
 *  2. **A person decides.** The assistant may analyse and recommend at any step
 *     it owns, but a step marked `requiresDecision` cannot complete without an
 *     employee and a decision. `workflows.ts` refuses to load a definition that
 *     breaks this.
 */
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { roleHasPermission } from "../auth/permissions";
import {
  employeeProfileRepository,
  workItemRepository,
  workItemEventRepository,
  workflowRunRepository,
  workflowStepRepository,
  knowledgeArticleRepository,
} from "../repositories";
import {
  definitionForKind,
  isWorkflowDefinition,
  nextStep,
  stepAt,
  workflowSpec,
  type Decision,
  type WorkflowDefinition,
} from "../employee/workflows";
import {
  assessWorkload,
  departmentFor,
  dueAtFor,
  findEscalations,
  routeWork,
  slaMinutesFor,
  WORK_KINDS,
  type Priority,
  type WorkKind,
} from "../employee/operationsManager";

const isWorkKind = (value: unknown): value is WorkKind =>
  typeof value === "string" && (WORK_KINDS as readonly string[]).includes(value);

/**
 * The employee behind a request.
 *
 * A user in the EMPLOYEE realm without a profile is a provisioning gap, not an
 * authorisation one — they signed in legitimately and somebody forgot to finish
 * setting them up. Saying so plainly is more useful than a 403 they cannot act
 * on.
 */
async function requireProfile(userId: string) {
  const profile = await employeeProfileRepository.findByUserId(userId);
  if (!profile) {
    throw new AppError(
      "Your employee profile has not been set up yet. Ask your branch administrator to complete it.",
      403,
      "NO_EMPLOYEE_PROFILE"
    );
  }
  if (profile.status !== "ACTIVE") {
    throw new AppError(
      "Your employee profile is not active.",
      403,
      "EMPLOYEE_PROFILE_INACTIVE"
    );
  }
  return profile;
}

/** Append to a work item's timeline. Best-effort — history is not a control. */
function recordEvent(input: {
  workItemId: string;
  kind: string;
  actorId?: string | null;
  summary: string;
  detail?: unknown;
}): void {
  void workItemEventRepository
    .create({
      workItemId: input.workItemId,
      kind: input.kind,
      actorId: input.actorId ?? null,
      summary: input.summary,
      detail: input.detail === undefined ? null : JSON.stringify(input.detail),
    })
    .catch(() => {
      /* the timeline is evidence, never a gate */
    });
}

/** `CLM-2026-4F2A9C` — the reference a person reads out on the phone. */
function makeReference(kind: WorkKind): string {
  const prefix = { CLAIM: "CLM", KYC: "KYC", RENEWAL: "REN", COMPLAINT: "CMP", APPOINTMENT: "APT", TASK: "TSK" }[kind];
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${new Date().getFullYear()}-${random}`;
}

export const employeeService = {
  /** The profile behind the signed-in employee, plus how their queue is doing. */
  async me(userId: string) {
    const profile = await requireProfile(userId);
    const queue = await workItemRepository.queueFor(profile.id, 200);
    const now = new Date();
    const overdue = queue.filter((item) => item.dueAt && item.dueAt < now).length;

    return {
      profile,
      workload: assessWorkload({
        employeeId: profile.id,
        openCount: queue.length,
        workloadLimit: profile.workloadLimit,
        overdueCount: overdue,
      }),
    };
  },

  /**
   * Create a piece of work and start its process.
   *
   * Routing, the promise it is measured against and the workflow are all
   * decided here rather than by the caller. A caller that could set its own due
   * time could quietly opt out of the measurement.
   */
  async createWork(input: {
    kind: string;
    title: string;
    summary?: string;
    priority?: string;
    customerId?: string | null;
    createdBy: string;
  }) {
    if (!isWorkKind(input.kind)) throw new AppError("Unknown kind of work.", 400);
    const priority: Priority = (["LOW", "NORMAL", "HIGH", "URGENT"] as const).includes(
      input.priority as Priority
    )
      ? (input.priority as Priority)
      : "NORMAL";

    const candidates = await employeeProfileRepository.routingCandidates(
      departmentFor(input.kind)
    );
    const routing = routeWork(input.kind, candidates);

    const item = await workItemRepository.create({
      kind: input.kind,
      reference: makeReference(input.kind),
      title: input.title,
      summary: input.summary ?? null,
      priority,
      status: "OPEN",
      assigneeId: routing.assigneeId,
      customerId: input.customerId ?? null,
      slaMinutes: slaMinutesFor(input.kind, priority),
      dueAt: dueAtFor(input.kind, priority),
    });

    recordEvent({
      workItemId: item.id,
      kind: "ASSIGNED",
      actorId: input.createdBy,
      summary: routing.assigneeId
        ? `Routed automatically. ${routing.reason}`
        : `Left unassigned. ${routing.reason}`,
      detail: { routing },
    });

    const definition = definitionForKind(input.kind);
    if (definition) await startWorkflow(item.id, definition);

    return item;
  },

  /**
   * Somebody's queue.
   *
   * `work.read.all` widens it to the whole operation; without that capability
   * the answer is always their own, whatever they ask for.
   */
  async queue(userId: string, role: string, options: { assigneeId?: string } = {}) {
    const profile = await requireProfile(userId);
    const seesEveryone = roleHasPermission(role, "work.read.all");

    if (options.assigneeId && options.assigneeId !== profile.id && !seesEveryone) {
      auditService.record({
        actorId: userId,
        action: "authz.work.scope_denied",
        metadata: { requested: options.assigneeId },
      });
      throw new AppError("You can only see work assigned to you.", 403);
    }

    const assigneeId = options.assigneeId ?? profile.id;
    return workItemRepository.queueFor(assigneeId, 100);
  },

  /**
   * One piece of work, with its process and its timeline.
   *
   * Readable by the person it is assigned to, or by somebody holding
   * `work.read.all`. Anything else is refused — a work item names a customer
   * and describes their circumstances.
   */
  async workItem(userId: string, role: string, id: string) {
    const profile = await requireProfile(userId);
    const item = await workItemRepository.findById(id);
    if (!item) throw new AppError("That work item does not exist.", 404);

    const mine = item.assigneeId === profile.id;
    if (!mine && !roleHasPermission(role, "work.read.all")) {
      auditService.record({
        actorId: userId,
        action: "authz.work.denied",
        metadata: { workItemId: id },
      });
      // Same answer as "does not exist": confirming a reference is real tells
      // somebody probing that a customer with that claim exists.
      throw new AppError("That work item does not exist.", 404);
    }

    const run = await workflowRunRepository.findByWorkItem(item.id);
    const steps = run ? await workflowStepRepository.forRun(run.id) : [];
    const timeline = await workItemEventRepository.timeline(item.id, 50);

    return { item, run, steps, timeline };
  },

  /**
   * Complete the current workflow step.
   *
   * The gate is here: a step that requires a decision cannot be completed
   * without one, and the capability it demands is checked against the caller's
   * role rather than assumed from the fact they hold the case.
   */
  async advanceWorkflow(
    userId: string,
    role: string,
    workItemId: string,
    input: { stepKey: string; decision?: string; notes?: string }
  ) {
    const profile = await requireProfile(userId);
    const item = await workItemRepository.findById(workItemId);
    if (!item) throw new AppError("That work item does not exist.", 404);

    if (item.assigneeId !== profile.id && !roleHasPermission(role, "work.read.all")) {
      throw new AppError("That work item does not exist.", 404);
    }

    const run = await workflowRunRepository.findByWorkItem(workItemId);
    if (!run || !isWorkflowDefinition(run.definition)) {
      throw new AppError("That work item has no workflow to advance.", 400);
    }
    if (run.status === "COMPLETED" || run.status === "REJECTED") {
      throw new AppError("That workflow has already finished.", 409);
    }
    if (run.currentStep !== input.stepKey) {
      // Guards the double-submit and the stale tab. Advancing a step that is
      // not current would skip whatever sits between them.
      throw new AppError("That is not the step this workflow is waiting on.", 409, "STEP_NOT_CURRENT");
    }

    const definition = run.definition as WorkflowDefinition;
    const step = stepAt(definition, input.stepKey);
    if (!step) throw new AppError("Unknown step.", 400);

    if (step.permission && !roleHasPermission(role, step.permission)) {
      auditService.record({
        actorId: userId,
        action: "authz.workflow.denied",
        metadata: { workItemId, step: step.key, required: step.permission },
      });
      throw new AppError("You do not have permission to complete this step.", 403);
    }

    if (step.requiresDecision && !isDecision(input.decision)) {
      throw new AppError(
        "This step needs a decision — approve, reject, escalate or request more information.",
        400,
        "DECISION_REQUIRED"
      );
    }

    const record = await workflowStepRepository.findByKey(run.id, step.key);
    if (record) {
      await workflowStepRepository.update(record.id, {
        status: input.decision === "REJECT" ? "REJECTED" : "COMPLETED",
        actorKind: "EMPLOYEE",
        actorId: profile.id,
        decision: input.decision ?? null,
        notes: input.notes ?? null,
        completedAt: new Date(),
      });
    }

    auditService.record({
      actorId: userId,
      action: "workflow.step.completed",
      entity: "WorkItem",
      entityId: workItemId,
      metadata: { definition, step: step.key, decision: input.decision ?? null },
    });
    recordEvent({
      workItemId,
      kind: "STEP_COMPLETED",
      actorId: userId,
      summary: input.decision
        ? `${step.name} — ${input.decision.toLowerCase()}.`
        : `${step.name} completed.`,
      detail: { step: step.key, decision: input.decision ?? null, notes: input.notes ?? null },
    });

    // A rejection ends the run. Continuing past a "no" would be the software
    // overruling the person, which is the one thing this design forbids.
    if (input.decision === "REJECT") {
      await workflowRunRepository.update(run.id, {
        status: "REJECTED",
        currentStep: null,
        completedAt: new Date(),
      });
      await workItemRepository.update(workItemId, {
        status: "CLOSED",
        resolvedAt: new Date(),
        closedAt: new Date(),
      });
      return { status: "REJECTED" as const, currentStep: null };
    }

    if (input.decision === "ESCALATE") {
      await workItemRepository.update(workItemId, { status: "AWAITING_APPROVAL", priority: "URGENT" });
      recordEvent({ workItemId, kind: "ESCALATED", actorId: userId, summary: "Escalated for review." });
      return { status: run.status, currentStep: run.currentStep };
    }

    const following = nextStep(definition, step.key);
    if (!following) {
      await workflowRunRepository.update(run.id, {
        status: "COMPLETED",
        currentStep: null,
        completedAt: new Date(),
      });
      await workItemRepository.update(workItemId, {
        status: "RESOLVED",
        resolvedAt: new Date(),
        closedAt: new Date(),
      });
      return { status: "COMPLETED" as const, currentStep: null };
    }

    await workflowRunRepository.update(run.id, {
      currentStep: following.key,
      status: following.actorKind === "EMPLOYEE" ? "AWAITING_HUMAN" : "RUNNING",
    });
    const followingRecord = await workflowStepRepository.findByKey(run.id, following.key);
    if (followingRecord) {
      await workflowStepRepository.update(followingRecord.id, {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      });
    }
    await workItemRepository.update(workItemId, {
      status: following.actorKind === "EMPLOYEE" ? "IN_PROGRESS" : "OPEN",
      ...(item.firstTouchAt ? {} : { firstTouchAt: new Date() }),
    });

    return { status: "RUNNING" as const, currentStep: following.key };
  },

  /** What a team lead needs to look at now. Requires the wider read. */
  async escalations(userId: string, role: string) {
    await requireProfile(userId);
    if (!roleHasPermission(role, "work.read.all")) {
      throw new AppError("You do not have permission to view the team's work.", 403);
    }

    const open = await workItemRepository.openForEscalation();
    return findEscalations(
      open.map((item) => ({
        id: item.id,
        priority: (item.priority as Priority) ?? "NORMAL",
        dueAt: item.dueAt,
        status: item.status,
        assigneeId: item.assigneeId,
      }))
    );
  },

  /**
   * The numbers on the dashboard.
   *
   * Scoped the same way the queue is: an employee sees their own performance,
   * a lead sees the operation's. Averages are computed over *resolved* work
   * only — including open items would make a busy day look like a fast one.
   */
  async analytics(userId: string, role: string) {
    const profile = await requireProfile(userId);
    const seesEveryone = roleHasPermission(role, "work.read.all");
    const scope = seesEveryone ? {} : { assigneeId: profile.id };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

    const [open, resolvedToday, resolvedWeek, overdue] = await Promise.all([
      workItemRepository.count({ ...scope, closedAt: null }),
      workItemRepository.count({ ...scope, resolvedAt: { gte: startOfToday } }),
      workItemRepository.findMany({ ...scope, resolvedAt: { gte: weekAgo } }),
      workItemRepository.count({ ...scope, closedAt: null, dueAt: { lt: now } }),
    ]);

    const durations = (resolvedWeek as { openedAt: Date; resolvedAt: Date | null }[])
      .filter((item) => item.resolvedAt)
      .map((item) => (item.resolvedAt as Date).getTime() - item.openedAt.getTime());

    const averageResolutionMinutes = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60_000)
      : null;

    return {
      scope: seesEveryone ? "TEAM" : "MINE",
      openCases: open,
      overdueCases: overdue,
      resolvedToday,
      resolvedThisWeek: durations.length,
      averageResolutionMinutes,
    };
  },

  /** Enterprise knowledge search. Read-only, and gated on `knowledge.read`. */
  async searchKnowledge(role: string, term: string, category?: string) {
    if (!roleHasPermission(role, "knowledge.read")) {
      throw new AppError("You do not have permission to search the knowledge centre.", 403);
    }
    return knowledgeArticleRepository.search(term, category);
  },
};

const isDecision = (value: unknown): value is Decision =>
  typeof value === "string" && ["APPROVE", "REJECT", "ESCALATE", "REQUEST_INFO"].includes(value);

/**
 * Materialise a workflow's steps when work is created.
 *
 * Rows for every step up front rather than one at a time, so a case view can
 * show the whole process — including what has not happened yet — which is what
 * makes it legible to somebody picking the case up cold.
 */
async function startWorkflow(workItemId: string, definition: WorkflowDefinition) {
  const spec = workflowSpec(definition);
  const first = spec.steps[0];
  if (!first) return;

  const run = await workflowRunRepository.create({
    workItemId,
    definition,
    currentStep: first.key,
    status: first.actorKind === "EMPLOYEE" ? "AWAITING_HUMAN" : "RUNNING",
  });

  for (const [index, step] of spec.steps.entries()) {
    await workflowStepRepository.create({
      runId: run.id,
      key: step.key,
      name: step.name,
      order: index,
      status: index === 0 ? "IN_PROGRESS" : "PENDING",
      ...(index === 0 ? { startedAt: new Date() } : {}),
    });
  }
}
