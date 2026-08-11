import rateLimit from "express-rate-limit";
import type { CorsOptions } from "cors";
import type { Request, Response, NextFunction } from "express";
import env from "./env";
import { RATE_LIMITS } from "./constants";
import { auditService } from "../services/audit.service";

/**
 * A blocked request used to just get a 429 with nothing left behind — a
 * sustained brute-force or scraping burst was invisible to the audit trail
 * even though it is exactly the kind of event a security review needs to see.
 * Replicates express-rate-limit's own default handler (status + JSON body)
 * so behaviour is unchanged; it only adds the audit record alongside it.
 */
const auditedRateLimitHandler =
  (action: string) =>
  (req: Request, res: Response, _next: NextFunction, options: { statusCode: number; message: unknown }): void => {
    auditService.record({
      actorId: req.user?.id ?? null,
      action,
      metadata: { ip: req.ip, path: req.originalUrl, method: req.method },
    });
    res.status(options.statusCode);
    if (!res.writableEnded) res.send(options.message);
  };

// Strict CORS: only browser origins on the validated allowlist may send
// credentialed requests. A wildcard origin is never combined with
// `credentials: true` (which is invalid and unsafe).
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests (no Origin header): curl,
    // server-to-server, health checks.
    if (!origin) return callback(null, true);
    if (env.allowedOrigins.includes(origin)) return callback(null, true);

    // Withhold the CORS headers rather than raise. CORS is not an authorisation
    // layer — it tells the *browser* whether to hand the response to the page,
    // and without these headers the browser refuses, which is the whole
    // mechanism working as intended.
    //
    // Raising here instead produced a 500 for what is a perfectly ordinary
    // client mistake, buried a real signal in the error handler, and left the
    // impression that CORS was stopping forged requests. It was not: a forged
    // request that sends no Origin at all never reaches this callback's
    // rejection path. Refusing state-changing requests is `verifyRequestOrigin`'s
    // job, and it answers with a 403.
    return callback(null, false);
  },
  // PATCH is required by `/auth/me/onboarding`. Omitting a method the API
  // actually routes makes the browser fail the preflight and drop the request
  // before it is ever sent — the client then has no response to read an error
  // message from, so the failure surfaces as a generic one.
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.windowMs, // 15 minutes
  max: RATE_LIMITS.API.max, // Limit each IP to N requests per window
  message: {
    status: "fail",
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: auditedRateLimitHandler("security.rate_limit.api"),
});

export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs, // 1 hour
  max: RATE_LIMITS.AUTH.max, // Limit each IP to N login/register requests per hour
  message: {
    status: "fail",
    message: "Too many authentication attempts, please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: auditedRateLimitHandler("security.rate_limit.auth"),
});

// Tighter limiter for endpoints that fan out to the paid LLM engine
// (chat + UI actions). Protects against cost-abuse / scraping bursts.
export const aiLimiter = rateLimit({
  windowMs: RATE_LIMITS.AI.windowMs, // 1 minute
  max: RATE_LIMITS.AI.max, // N AI-backed calls per IP per minute
  message: {
    status: "fail",
    message: "Too many AI requests. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: auditedRateLimitHandler("security.rate_limit.ai"),
});
