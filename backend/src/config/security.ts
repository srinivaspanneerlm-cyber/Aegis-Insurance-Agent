import rateLimit from "express-rate-limit";
import type { CorsOptions } from "cors";
import env from "./env";
import { RATE_LIMITS } from "./constants";

// Strict CORS: only browser origins on the validated allowlist may send
// credentialed requests. A wildcard origin is never combined with
// `credentials: true` (which is invalid and unsafe).
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests (no Origin header): curl,
    // server-to-server, health checks.
    if (!origin) return callback(null, true);
    if (env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
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
});
