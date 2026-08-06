import express from "express";
import type { Request } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { intelligenceService } from "../services/intelligence.service";
import { analyticsService } from "../services/intelligenceAnalytics.service";

const router = express.Router();

/**
 * The Insurance Intelligence Engine, over HTTP.
 *
 * Scope-walled rather than realm-walled, like the document platform and for the
 * same reason: a customer has every right to their own analysis, an employee
 * needs a customer's in order to advise them, and an administrator needs the
 * aggregate without needing either.
 *
 * The `userId` query parameter is accepted on the customer routes but never
 * trusted — `intelligenceService.authoriseFor` decides whether the caller may
 * use it, and refuses with an audited 403 when they may not. Every route below
 * goes through that one function, so a new endpoint cannot skip the check.
 */
router.use(protect);

const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const q = (req: Request, key: string): string | undefined =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
/** Route params are typed loosely by Express; narrow rather than cast. */
const param = (req: Request, key: string): string =>
  typeof req.params[key] === "string" ? (req.params[key] as string) : "";

// ── Profile ──────────────────────────────────────────────────────────────────

router.get(
  "/profile",
  catchAsync(async (req, res) => {
    const result = await intelligenceService.getProfile(actor(req), q(req, "userId"));
    sendSuccess(res, 200, result);
  })
);

router.put(
  "/profile",
  catchAsync(async (req, res) => {
    const result = await intelligenceService.saveProfile(actor(req), req.body ?? {}, q(req, "userId"));
    sendSuccess(res, 200, result);
  })
);

router.post(
  "/policies",
  catchAsync(async (req, res) => {
    const created = await intelligenceService.addHeldPolicy(
      actor(req),
      req.body ?? {},
      q(req, "userId")
    );
    sendSuccess(res, 201, created);
  })
);

router.delete(
  "/policies/:id",
  catchAsync(async (req, res) => {
    const result = await intelligenceService.removeHeldPolicy(
      actor(req),
      param(req, "id"),
      q(req, "userId")
    );
    sendSuccess(res, 200, result);
  })
);

// ── The analysis ─────────────────────────────────────────────────────────────

/**
 * The whole report.
 *
 * One endpoint rather than six, because every part of it depends on the others
 * and fetching them separately would let a portal show a recommendation built
 * from one version of the facts beside a risk summary built from another.
 */
router.get(
  "/report",
  catchAsync(async (req, res) => {
    const report = await intelligenceService.report(actor(req), {
      ...(q(req, "userId") ? { targetUserId: q(req, "userId") as string } : {}),
      fresh: q(req, "fresh") === "true",
    });
    sendSuccess(res, 200, report);
  })
);

router.get(
  "/history",
  catchAsync(async (req, res) => {
    const runs = await intelligenceService.history(
      actor(req),
      q(req, "userId"),
      Number(q(req, "limit") ?? 20)
    );
    sendSuccess(res, 200, { runs }, { results: runs.length });
  })
);

// ── Employee intelligence ────────────────────────────────────────────────────

/**
 * Everything an employee needs before speaking to a customer, in one call.
 *
 * Behind `customer.read` rather than `analytics.read`: this is one person's
 * file, not a business metric, and the permission that governs it should be the
 * one that governs seeing a customer at all.
 */
router.get(
  "/customers",
  requirePermission("customer.read"),
  catchAsync(async (req, res) => {
    const result = await analyticsService.searchCustomers(
      actor(req),
      q(req, "search"),
      Number(q(req, "take") ?? 20)
    );
    sendSuccess(res, 200, result, { results: result.customers.length });
  })
);

router.get(
  "/customer/:userId/brief",
  requirePermission("customer.read"),
  catchAsync(async (req, res) => {
    const brief = await analyticsService.customerBrief(actor(req), param(req, "userId"));
    sendSuccess(res, 200, brief);
  })
);

// ── Admin intelligence ───────────────────────────────────────────────────────

/**
 * Aggregates only.
 *
 * Nothing on this route identifies a customer — it returns counts, trends and
 * distributions. An administrator who needs one customer's file uses the brief
 * above, which requires `customer.read` and is audited.
 */
router.get(
  "/analytics/overview",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await analyticsService.overview());
  })
);

router.get(
  "/analytics/risk-distribution",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await analyticsService.riskDistribution());
  })
);

router.get(
  "/analytics/coverage-gaps",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await analyticsService.gapTrends());
  })
);

router.get(
  "/analytics/renewals",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await analyticsService.renewalAnalytics());
  })
);

export default router;
