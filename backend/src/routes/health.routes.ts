/**
 * Liveness / readiness probes for orchestrators & load balancers.
 *
 *   GET /health/live   — process is up (never touches dependencies).
 *   GET /health/ready  — safe to receive traffic. Gated on the DATABASE (the
 *                        one hard dependency); cache + AI engine are reported
 *                        for observability but are soft (the app degrades
 *                        gracefully without them).
 *
 * Kept outside `/api` so it is unthrottled, and mounted alongside the existing
 * minimal `/health` (preserved for backward compatibility).
 */
import express from "express";
import prisma from "../config/db";
import cache from "../services/cache.service";
import env from "../config/env";

const router = express.Router();

router.get("/live", (_req, res) => {
  res.status(200).json({ status: "alive" });
});

router.get("/ready", async (_req, res) => {
  const checks = { database: false, cache: false, ai: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    /* database unreachable */
  }

  try {
    checks.cache = await cache.health();
  } catch {
    /* cache degrades to no-op; not a readiness blocker */
  }

  try {
    const origin = new URL(env.AI_SERVICE_URL).origin;
    const res2 = await fetch(`${origin}/health/live`, { signal: AbortSignal.timeout(2000) });
    checks.ai = res2.ok;
  } catch {
    /* AI engine is a soft dependency for readiness */
  }

  const ready = checks.database;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks });
});

export = router;
