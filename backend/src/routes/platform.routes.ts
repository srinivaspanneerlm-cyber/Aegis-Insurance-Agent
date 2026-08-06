import express from "express";
import type { Request } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission, requireRealm, requireFreshAuth } from "../middleware/auth.middleware";
import { platformService } from "../services/platform.service";

const router = express.Router();

/**
 * Platform administration.
 *
 * The narrowest door on the platform: the PLATFORM realm *and*
 * `platform.configure`, which only the operator role holds. An enterprise
 * administrator cannot reach any of it — their authority stops at their own
 * organisation, and this is the console above every organisation.
 *
 * Reads are gated on realm and capability. **Writes additionally require a
 * fresh re-authentication**, because everything mutable here is structural:
 * suspending a tenant signs out their whole staff, and changing a setting
 * affects every request the platform serves. A session cookie alone cannot tell
 * the operator from whoever sat down at their unlocked laptop.
 */
router.use(protect, requireRealm("PLATFORM"), requirePermission("platform.configure"));

const q = (req: Request, key: string): string | undefined =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
const param = (req: Request, key: string): string =>
  typeof req.params[key] === "string" ? (req.params[key] as string) : "";

// ── Overview and infrastructure ──────────────────────────────────────────────

router.get(
  "/overview",
  catchAsync(async (_req, res) => sendSuccess(res, 200, await platformService.overview()))
);

router.get(
  "/backup",
  catchAsync(async (_req, res) => sendSuccess(res, 200, await platformService.backupState()))
);

router.get(
  "/integrations",
  catchAsync(async (_req, res) => sendSuccess(res, 200, { integrations: platformService.integrations() }))
);

// ── Organizations ────────────────────────────────────────────────────────────

router.get(
  "/organizations",
  catchAsync(async (req, res) => {
    const result = await platformService.organizations({
      ...(q(req, "search") ? { search: q(req, "search") as string } : {}),
      ...(q(req, "status") ? { status: q(req, "status") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.organizations.length });
  })
);

router.post(
  "/organizations",
  requireFreshAuth,
  catchAsync(async (req, res) => {
    const organization = await platformService.createOrganization(req.body, req.user!.id);
    sendSuccess(res, 201, { organization });
  })
);

// Suspension ends every session that tenant's staff hold, so it is a write in
// the fullest sense — hence the fresh-auth gate.
router.patch(
  "/organizations/:id/status",
  requireFreshAuth,
  catchAsync(async (req, res) => {
    const result = await platformService.setOrganizationStatus(
      param(req, "id"),
      req.body.status,
      req.user!.id
    );
    sendSuccess(res, 200, result);
  })
);

// ── Licensing ────────────────────────────────────────────────────────────────

router.get(
  "/licences",
  catchAsync(async (_req, res) =>
    sendSuccess(res, 200, { licences: await platformService.licences() })
  )
);

router.patch(
  "/organizations/:id/licence",
  requireFreshAuth,
  catchAsync(async (req, res) => {
    const result = await platformService.updateLicense(param(req, "id"), req.body, req.user!.id);
    sendSuccess(res, 200, result);
  })
);

// ── Identity ─────────────────────────────────────────────────────────────────

router.get(
  "/identities",
  catchAsync(async (req, res) => {
    const result = await platformService.identities({
      ...(q(req, "realm") ? { realm: q(req, "realm") as string } : {}),
      ...(q(req, "search") ? { search: q(req, "search") as string } : {}),
      take: req.query.take,
    });
    sendSuccess(res, 200, result, { results: result.users.length });
  })
);

// The role model is read-only by construction: roles live in code.
router.get("/roles", catchAsync(async (_req, res) => sendSuccess(res, 200, platformService.roleModel())));

router.get(
  "/sessions",
  catchAsync(async (req, res) =>
    sendSuccess(res, 200, await platformService.sessions({ take: req.query.take }))
  )
);

router.delete(
  "/sessions/:id",
  requireFreshAuth,
  catchAsync(async (req, res) =>
    sendSuccess(res, 200, await platformService.revokeSession(param(req, "id"), req.user!.id))
  )
);

// ── Configuration ────────────────────────────────────────────────────────────

router.get(
  "/settings",
  catchAsync(async (_req, res) => sendSuccess(res, 200, await platformService.settings()))
);

router.patch(
  "/settings/:key",
  requireFreshAuth,
  catchAsync(async (req, res) => {
    const setting = await platformService.updateSetting(
      param(req, "key"),
      String(req.body.value ?? ""),
      req.user!.id
    );
    sendSuccess(res, 200, { setting });
  })
);

// ── Security and governance ──────────────────────────────────────────────────

router.get(
  "/security",
  catchAsync(async (req, res) =>
    sendSuccess(res, 200, await platformService.security({ take: req.query.take }))
  )
);

// Monitoring only — there is deliberately no route that changes a model, a
// prompt or a routing rule. See `changeControl` in the payload.
router.get(
  "/ai-governance",
  catchAsync(async (_req, res) => sendSuccess(res, 200, await platformService.aiGovernance()))
);

export = router;
