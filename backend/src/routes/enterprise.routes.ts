import express from "express";
import type { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import AppError from "../utils/appError";
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

/**
 * The tenant this request may see, taken from the session and nowhere else.
 *
 * Never from the query, the body or a header: an organisation id a client can
 * supply is an organisation id a client can change. `req.user` is loaded from
 * the database by `protect` on every request, so this is the stored membership
 * rather than anything the caller asserted.
 *
 * An administrator with no organisation gets nothing, not everything. Before
 * this the service queried globally, so a tenant admin read every tenant's
 * records; failing closed is the only safe reading of "no organisation".
 */
const orgScope = (req: Request): string => {
  const organizationId = (req.user as { organizationId?: string | null } | undefined)?.organizationId;
  if (!organizationId) {
    throw new AppError(
      "This account is not attached to an organisation, so there is nothing for it to administer.",
      403,
      "NO_ORGANIZATION"
    );
  }
  return organizationId;
};

// ── Overview ─────────────────────────────────────────────────────────────────

router.get(
  "/dashboard",
  requirePermission("analytics.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.dashboard(orgScope(req)));
  })
);

router.get(
  "/analytics",
  requirePermission("analytics.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.analytics(orgScope(req)));
  })
);

// ── The tenant itself ────────────────────────────────────────────────────────

// Read-only by construction. Creating, suspending and licensing an
// organisation live in the platform realm — a tenant that could lift its own
// suspension is not a tenant.
router.get(
  "/organization",
  requirePermission("analytics.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.organization(orgScope(req)));
  })
);

// ── People ───────────────────────────────────────────────────────────────────

router.get(
  "/customers",
  requirePermission("customer.read"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.customers(orgScope(req), {
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
    sendSuccess(res, 200, await enterpriseAdminService.customer(orgScope(req), id));
  })
);

router.get(
  "/employees",
  requirePermission("staff.manage"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.employees(orgScope(req), {
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
    sendSuccess(res, 200, await enterpriseAdminService.products(orgScope(req), { take: req.query.take }));
  })
);

router.get(
  "/claims",
  requirePermission("claim.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.claims(orgScope(req)));
  })
);

router.get(
  "/policies",
  requirePermission("policy.read"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.policies(orgScope(req), {
      ...(q(req, "status") ? { status: q(req, "status") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.policies.length });
  })
);

// ── AI and workflow ──────────────────────────────────────────────────────────

// Monitoring only. There is deliberately no route that changes a model, a
// prompt or a routing rule — see the module comment in admin/aiSystems.ts.
router.get(
  "/ai-systems",
  requirePermission("platform.configure"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, { systems: await enterpriseAdminService.aiSystems(orgScope(req)) });
  })
);

router.get(
  "/workflows",
  requirePermission("analytics.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.workflows(orgScope(req)));
  })
);

// ── Governance ───────────────────────────────────────────────────────────────

router.get(
  "/compliance",
  requirePermission("audit.read"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await enterpriseAdminService.compliance(orgScope(req)));
  })
);

router.get(
  "/audit",
  requirePermission("audit.read"),
  catchAsync(async (req, res) => {
    const result = await enterpriseAdminService.auditLog(orgScope(req), {
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
    sendSuccess(res, 200, await enterpriseAdminService.securityEvents(orgScope(req), { take: req.query.take }));
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
    const report = await enterpriseAdminService.report(orgScope(req), kind, req.user!.id);

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
