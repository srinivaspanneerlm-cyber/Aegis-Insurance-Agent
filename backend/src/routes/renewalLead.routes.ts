import express from "express";
import type { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { idParamSchema } from "../validations/schemas";
import {
  renewalLeadAdvanceSchema,
  renewalLeadQuerySchema,
} from "../validations/renewalLead.schemas";
import { renewalLeadService } from "../services/renewalLead.service";
import { toCsv } from "../services/admin.enterprise.service";
import { auditService } from "../services/audit.service";
import type { ContactChannel, RenewalLeadStatus } from "../consumer/renewalLead";

const router = express.Router();

/**
 * The renewal request queue, for the people who work it.
 *
 * Permission-walled with `lead.read` and `lead.write` — the capabilities that
 * already mean "may work the pipeline", already held by every employee, and
 * already separated the way this surface needs them: seeing a queue is not the
 * same authority as moving somebody's request through it. Minting
 * `renewal.read` would have produced a dashboard nobody could open until a
 * separate change granted it.
 *
 * These rows are **not tenant-scoped**, and that is a property of the data
 * rather than a gap. A customer's `organizationId` is null by design, so a
 * renewal request belongs to the Aegis consumer funnel and not to any one
 * organisation; a tenant filter here would match nothing and show an empty
 * queue. Partitioning later is additive.
 *
 * Separate from `lead.routes.ts` because a `RenewalLead` is not a `Lead`. That
 * model is a sales enquiry the platform created about a prospect; this is a
 * person who already holds cover asking for help with it, and their five states
 * are an operations hand-off rather than a sales funnel.
 */
router.use(protect);

const q = (req: Request, key: string): string | undefined =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;

const filters = (req: Request) => ({
  ...(q(req, "status") ? { status: q(req, "status") as RenewalLeadStatus } : {}),
  ...(q(req, "channel") ? { channel: q(req, "channel") as ContactChannel } : {}),
});

/**
 * The queue, or a CSV of it.
 *
 * `?format=csv` reuses the platform's existing report export — `toCsv`, which
 * quotes every field and neutralises a leading formula character. That last
 * part is why it is reused rather than rewritten: a customer's own name is in
 * these rows, and a name beginning `=HYPERLINK(...)` becomes a working link the
 * moment somebody opens the file in a spreadsheet.
 *
 * The filename is built from a timestamp and a fixed word, never from a query
 * parameter — a download header assembled from user input is a header-injection
 * vector.
 */
router.get(
  "/",
  requirePermission("lead.read"),
  validateQuery(renewalLeadQuerySchema),
  catchAsync(async (req: Request, res: Response) => {
    if (q(req, "format") === "csv") {
      const rows = await renewalLeadService.exportRows(filters(req));

      // An export leaves the platform and stops being governed by it, so it is
      // recorded as its own action rather than folded into a read.
      auditService.record({
        actorId: req.user!.id,
        action: "renewalLead.exported",
        entity: "RenewalLead",
        metadata: { rows: rows.length, ...filters(req) },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="aegis-renewal-requests-${stamp}.csv"`
      );
      res.send(toCsv(rows));
      return;
    }

    const result = await renewalLeadService.queue({
      ...filters(req),
      ...(q(req, "page") ? { page: Number(q(req, "page")) } : {}),
      ...(q(req, "limit") ? { limit: Number(q(req, "limit")) } : {}),
    });
    sendSuccess(res, 200, { leads: result.leads }, { pagination: result.pagination });
  })
);

router.get(
  "/:id",
  requirePermission("lead.read"),
  validateParams(idParamSchema),
  catchAsync(async (req: Request, res: Response) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    sendSuccess(res, 200, { lead: await renewalLeadService.detail(id) });
  })
);

/**
 * Move a request along.
 *
 * `PATCH` with a validated body rather than a `PUT` that takes what it is given.
 * The record carries a `userId`, a `consentId`, the urgency snapshot the queue
 * sorts by and a `deletedAt`; without an allow-list every one of them would be
 * writable by anybody holding `lead.write`, which is the bug this codebase has
 * already found once on the sales-lead route.
 */
router.patch(
  "/:id",
  requirePermission("lead.write"),
  validateParams(idParamSchema),
  validateBody(renewalLeadAdvanceSchema),
  catchAsync(async (req: Request, res: Response) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const lead = await renewalLeadService.advance(req.user!.id, id, {
      status: req.body.status,
      closedReason: req.body.closedReason ?? null,
      ...(req.body.assignToMe !== undefined ? { assignToMe: req.body.assignToMe } : {}),
    });
    sendSuccess(res, 200, { lead });
  })
);

export = router;
