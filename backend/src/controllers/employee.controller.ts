import catchAsync from "../utils/catchAsync";
import { employeeService } from "../services/employee.service";
import { sendSuccess } from "../utils/apiResponse";
import { WORKFLOW_DEFINITIONS, workflowSpec } from "../employee/workflows";

/**
 * Employee operations endpoints.
 *
 * Every handler takes the caller's id *and* role from `req.user`, which
 * `protect` filled from the stored record. Nothing reads identity or scope from
 * the request body — a caller that could name its own assignee would be
 * choosing its own authorisation.
 */

const me = catchAsync(async (req, res) => {
  sendSuccess(res, 200, await employeeService.me(req.user!.id));
});

const queue = catchAsync(async (req, res) => {
  const assigneeId = typeof req.query.assigneeId === "string" ? req.query.assigneeId : undefined;
  const items = await employeeService.queue(req.user!.id, req.user!.role, {
    ...(assigneeId ? { assigneeId } : {}),
  });
  sendSuccess(res, 200, { items }, { results: items.length });
});

const workItem = catchAsync(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  sendSuccess(res, 200, await employeeService.workItem(req.user!.id, req.user!.role, id));
});

const createWork = catchAsync(async (req, res) => {
  const item = await employeeService.createWork({
    kind: req.body.kind,
    title: req.body.title,
    summary: req.body.summary,
    priority: req.body.priority,
    customerId: req.body.customerId ?? null,
    createdBy: req.user!.id,
  });
  sendSuccess(res, 201, { item });
});

const advanceWorkflow = catchAsync(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const result = await employeeService.advanceWorkflow(req.user!.id, req.user!.role, id, {
    stepKey: req.body.stepKey,
    decision: req.body.decision,
    notes: req.body.notes,
  });
  sendSuccess(res, 200, result);
});

const escalations = catchAsync(async (req, res) => {
  const items = await employeeService.escalations(req.user!.id, req.user!.role);
  sendSuccess(res, 200, { escalations: items }, { results: items.length });
});

const analytics = catchAsync(async (req, res) => {
  sendSuccess(res, 200, await employeeService.analytics(req.user!.id, req.user!.role));
});

const knowledge = catchAsync(async (req, res) => {
  const term = typeof req.query.q === "string" ? req.query.q : "";
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const articles = await employeeService.searchKnowledge(req.user!.role, term, category);
  sendSuccess(res, 200, { articles }, { results: articles.length });
});

/**
 * The workflow definitions themselves.
 *
 * Served so the portal can render a process — including the steps not reached
 * yet — without keeping its own copy that would drift from the one the server
 * actually runs.
 */
const definitions = catchAsync(async (_req, res) => {
  sendSuccess(res, 200, {
    definitions: WORKFLOW_DEFINITIONS.map((definition) => {
      const spec = workflowSpec(definition);
      return {
        definition,
        label: spec.label,
        kind: spec.kind,
        steps: spec.steps.map((step) => ({
          key: step.key,
          name: step.name,
          description: step.description,
          actorKind: step.actorKind,
          requiresDecision: Boolean(step.requiresDecision),
        })),
      };
    }),
  });
});

export {
  me,
  queue,
  workItem,
  createWork,
  advanceWorkflow,
  escalations,
  analytics,
  knowledge,
  definitions,
};
