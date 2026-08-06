import express from "express";
import type { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission, requireRealm } from "../middleware/auth.middleware";
import { enterpriseAdminService, toCsv } from "../services/admin.enterprise.service";

const router = express.Router();

/**
 * The enterprise administration API.
 *
 * Walled at the realm as a whole, then gated per route on the capability the
 * section needs. Both, for the same reason the employee routes have both: the
 * realm asks whether somebody belongs on this side of the platform, the
 * permission asks what they may do once here, and either alone leaves a hole.
 *
 * Note what is absent. There is no route here that approves a claim, verifies
 * an identity or edits a customer's record. Those decisions stay with the
 * people answerable for them — an admin console that could quietly approve a
 * claim would make the human gate in the workflow engine decorative.
 */
// No limiter here: `apiLimiter` is already mounted on /api in app.ts, and
// adding it again would count every request twice against the same window —
// halving the budget for administrators who legitimately load several panels
// at once.
router.use(protect, requireRealm("ENTERPRISE"));

const q = (req: Request, key: string): string | undefined =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;

// ── Overview ─────────────────────────────────────────────────────────────────

router.get(
  "/dashboard",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.dashboard());
  })
);

router.get(
  "/analytics",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.analytics());
  })
);

// ── People ───────────────────────────────────────────────────────────────────

router.get(
  "/customers",
  requirePermission("customer.read"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.customers({
      ...(q(req, "search") ? { search: q(req, "search") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.customers.length });
  })
);

router.get(
  "/customers/:id",
  requirePermission("customer.read"),
  catchAsync(async (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    sendSuccess(res, 200, await enterpriseAdminService.customer(id));
  })
);

router.get(
  "/employees",
  requirePermission("staff.manage"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.employees({
      ...(q(req, "department") ? { department: q(req, "department") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.employees.length });
  })
);

// ── Business ─────────────────────────────────────────────────────────────────

router.get(
  "/products",
  requirePermission("policy.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.products({ take: req.query.take }));
  })
);

router.get(
  "/claims",
  requirePermission("claim.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.claims());
  })
);

// ── AI and workflow ──────────────────────────────────────────────────────────

// Monitoring only. There is deliberately no route that changes a model, a
// prompt or a routing rule — see the module comment in admin/aiSystems.ts.
router.get(
  "/ai-systems",
  requirePermission("platform.configure"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, { systems: await enterpriseAdminService.aiSystems() });
  })
);

router.get(
  "/workflows",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.workflows());
  })
);

// ── Governance ───────────────────────────────────────────────────────────────

router.get(
  "/compliance",
  requirePermission("audit.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.compliance());
  })
);

router.get(
  "/audit",
  requirePermission("audit.read"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.auditLog({
      ...(q(req, "action") ? { action: q(req, "action") as string } : {}),
      ...(q(req, "actorId") ? { actorId: q(req, "actorId") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.entries.length });
  })
);

router.get(
  "/security-events",
  requirePermission("audit.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.securityEvents({ take: req.query.take }));
  })
);

// ── Reports ──────────────────────────────────────────────────────────────────

/**
 * A report, as JSON or CSV.
 *
 * `?format=csv` sets a download disposition. The filename is built from a fixed
 * set of report ids and a timestamp — never from user input, which is how a
 * download header becomes a header-injection vector.
 */
router.get(
  "/reports/:kind",
  requirePermission("analytics.read"),
  catchAsync(async (req: Request, res: Response) => {
    const kind = typeof req.params.kind === "string" ? req.params.kind : "";
    const report = await enterpriseAdminService.report(kind, req.user!.id);

    if (q(req, "format") === "csv") {
      const stamp = new Date().toISOString().slice(0, 10);
      // `kind` has already been matched against the generator table, so it is
      // one of a known set by the time it reaches here.
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="aegis-${report.kind}-${stamp}.csv"`);
      res.send(toCsv(report.rows));
      return;
    }

    sendSuccess(res, 200, report);
  })
);

export = router;
