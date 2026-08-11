import express from "express";
import type { Request } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { documentService } from "../services/document.service";

const router = express.Router();

/**
 * The document platform, shared by every portal.
 *
 * Not realm-walled, and that is the deliberate difference from the employee and
 * enterprise routes: a customer has a legitimate need to see and manage *their
 * own* documents, so the wall here is scope rather than realm. Every read is
 * built from the caller's id unless they hold `work.read.all`, and the caller
 * never names whose documents they want.
 */
router.use(protect);

const q = (req: Request, key: string): string | undefined =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
const param = (req: Request, key: string): string =>
  typeof req.params[key] === "string" ? (req.params[key] as string) : "";
const actor = (req: Request) => ({
  id: req.user!.id,
  role: req.user!.role,
  organizationId: req.user!.organizationId,
});

// ── The customer's own workspace ─────────────────────────────────────────────

router.get(
  "/",
  catchAsync(async (req, res) => {
    const result = await documentService.list(actor(req), {
      ...(q(req, "status") ? { status: q(req, "status") as string } : {}),
      ...(q(req, "domain") ? { domain: q(req, "domain") as string } : {}),
      ...(q(req, "search") ? { search: q(req, "search") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.documents.length });
  })
);

router.get(
  "/requirements",
  catchAsync(async (req, res) => {
    // Always the caller's own. An employee asking for a customer's outstanding
    // documents goes through the work item, which is already scoped.
    sendSuccess(res, 200, await documentService.requirementsFor(req.user!.id));
  })
);

router.get(
  "/:id",
  catchAsync(async (req, res) =>
    sendSuccess(res, 200, await documentService.detail(actor(req), param(req, "id")))
  )
);

router.delete(
  "/:id",
  catchAsync(async (req, res) =>
    sendSuccess(res, 200, await documentService.remove(actor(req), param(req, "id")))
  )
);

// ── Processing ───────────────────────────────────────────────────────────────

// Re-run the pipeline. Useful after a stage's service is configured, and the
// only way a document that failed processing gets another attempt.
router.post(
  "/:id/process",
  requirePermission("work.write"),
  catchAsync(async (req, res) =>
    sendSuccess(res, 200, await documentService.process(param(req, "id"), actor(req)))
  )
);

// ── Verification ─────────────────────────────────────────────────────────────

router.get(
  "/queue/pending",
  requirePermission("work.read"),
  catchAsync(async (req, res) => {
    const result = await documentService.queue(actor(req), { take: req.query.take });
    sendSuccess(res, 200, result, { results: result.documents.length });
  })
);

// The only path to VERIFIED or REJECTED, and it always records who decided.
router.post(
  "/:id/decision",
  requirePermission("work.write"),
  catchAsync(async (req, res) => {
    const document = await documentService.decide(
      param(req, "id"),
      { decision: req.body.decision, reason: req.body.reason },
      actor(req)
    );
    sendSuccess(res, 200, { document });
  })
);

// ── Requests ─────────────────────────────────────────────────────────────────

// Ask a customer for documents. An agent or an employee decides the facts; the
// resolver decides what those facts require.
router.post(
  "/requests",
  requirePermission("work.write"),
  catchAsync(async (req, res) => {
    const result = await documentService.requestDocuments(
      req.body.subjectId,
      {
        domain: req.body.domain,
        purpose: req.body.purpose ?? "APPLICATION",
        workItemId: req.body.workItemId ?? null,
        facts: req.body.facts ?? {},
      },
      req.user!.id
    );
    sendSuccess(res, 201, result);
  })
);

// ── Statistics ───────────────────────────────────────────────────────────────

// Counts only — no document contents, no filenames. An administrator monitoring
// throughput has no need to see what a customer uploaded.
router.get(
  "/stats/overview",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => sendSuccess(res, 200, await documentService.statistics()))
);

export = router;
