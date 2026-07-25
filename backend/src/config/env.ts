/**
 * Centralised, validated environment configuration.
 *
 * This module is the single source of truth for environment-derived config.
 * It performs fail-fast validation at boot so the server never starts in an
 * insecure or misconfigured state (e.g. missing / weak JWT secret in prod).
 *
 * Import `env` anywhere instead of reading `process.env` directly.
 */

import resolveServerTimeouts from "./serverTimeouts";

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// A short list of obviously-insecure default secrets that must never be used.
const WEAK_SECRET_PATTERNS = [
  "secret",
  "changeme",
  "change_me",
  "super-secret",
  "supersecret",
  "jwt_secret",
  "password",
  "default",
];

const errors: string[] = [];
const warnings: string[] = [];

// ── JWT secret ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "";
const looksWeak = WEAK_SECRET_PATTERNS.some((p) =>
  JWT_SECRET.toLowerCase().includes(p)
);

if (!JWT_SECRET) {
  errors.push("JWT_SECRET is not set. Refusing to start without a signing secret.");
} else if (JWT_SECRET.length < 32) {
  const msg = `JWT_SECRET is too short (${JWT_SECRET.length} chars). Use at least 32 random characters.`;
  isProd ? errors.push(msg) : warnings.push(msg);
} else if (looksWeak) {
  const msg = "JWT_SECRET appears to be a well-known/default value. Rotate it to a high-entropy random string.";
  isProd ? errors.push(msg) : warnings.push(msg);
}

// ── CORS origins ────────────────────────────────────────────────────────────
// Comma-separated allowlist. In production a wildcard is never permitted.
const rawOrigins = process.env.CLIENT_URL || "";
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (isProd && allowedOrigins.length === 0) {
  errors.push("CLIENT_URL must list explicit allowed origin(s) in production (wildcard is not allowed with credentials).");
}
if (allowedOrigins.length === 0) {
  // Safe developer default — does not apply in production (guarded above).
  allowedOrigins.push("http://localhost:3000");
}

// ── HTTP keep-alive timeouts ──────────────────────────────────────────────────
// Tuned to survive an upstream proxy's idle timeout (see serverTimeouts.ts). A
// misordered pair (headers ≤ keepAlive) would silently cut requests short, so
// it fails fast in production and warns in development.
const serverTimeouts = resolveServerTimeouts(process.env);
serverTimeouts.errors.forEach((msg) =>
  isProd ? errors.push(msg) : warnings.push(msg)
);

// ── Report & fail fast ──────────────────────────────────────────────────────
if (warnings.length) {
  // eslint-disable-next-line no-console
  console.warn("⚠️  Config warnings:\n  - " + warnings.join("\n  - "));
}
if (errors.length) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid security configuration — server will not start:\n  - " + errors.join("\n  - "));
  process.exit(1);
}

const env = {
  NODE_ENV,
  isProd,
  PORT: parseInt(process.env.PORT || "5000", 10),

  // HTTP keep-alive tuning (see serverTimeouts.ts). Applied to the http.Server
  // in server.ts so idle connections outlive the upstream proxy's idle timeout.
  KEEPALIVE_TIMEOUT_MS: serverTimeouts.keepAliveTimeoutMs,
  HEADERS_TIMEOUT_MS: serverTimeouts.headersTimeoutMs,

  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",

  // Access-token lifetime defaults to JWT_EXPIRES_IN (unchanged behaviour); it
  // can be shortened once a refresh flow is active on the client. The refresh
  // token is the long-lived, rotating, revocable credential.
  ACCESS_TOKEN_EXPIRES_IN:
    process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "30d",
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",

  // Logging. LOG_FORMAT "json" → structured pino access logs (default in prod);
  // "dev" → morgan pretty output (default in development).
  LOG_FORMAT: (process.env.LOG_FORMAT || (isProd ? "json" : "dev")).toLowerCase(),
  LOG_LEVEL: (process.env.LOG_LEVEL || (isProd ? "info" : "debug")).toLowerCase(),

  allowedOrigins,

  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000/api/ai",
  AI_INTERNAL_API_KEY: process.env.AI_INTERNAL_API_KEY || "",

  // Google Sign-In. The OAuth 2.0 Web client ID is used both to render the
  // Google button (frontend, via NEXT_PUBLIC_GOOGLE_CLIENT_ID) and to verify
  // the returned ID token's audience here. When unset, the /auth/google route
  // fails closed with a clear "not configured" error — email/password login is
  // unaffected. The client ID is public (embedded in the frontend); it is not a
  // secret and carries no client secret.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",

  // Redis connection string for the shared cache (and future job queue). When
  // unset, the cache falls back to an in-process store — so dev / single-node
  // runs need no Redis, and multi-node deployments just set this.
  REDIS_URL: process.env.REDIS_URL || "",

  // Whether the auth cookie carries the `Secure` flag (HTTPS-only). Defaults to
  // the production flag, but is overridable so a prod-mode box served over
  // plain HTTP (e.g. local dev) can still set the cookie. Set to "true" once
  // you serve over TLS.
  COOKIE_SECURE:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE.toLowerCase() === "true"
      : isProd,

  // Startup convenience flag (kill -9 on occupied port). Disabled by default.
  AUTO_RELEASE_PORT: (process.env.AUTO_RELEASE_PORT || "false").toLowerCase() === "true",

  // Express `trust proxy` setting. Controls how req.ip (used by the rate
  // limiter) is derived from X-Forwarded-For. Keep "false" when the app is
  // directly exposed; set to the NUMBER OF TRUSTED PROXIES (e.g. "1" behind a
  // single load balancer) in production. Never set "true" blindly — that lets
  // clients spoof their IP and evade rate limiting.
  TRUST_PROXY: ((): boolean | number => {
    const raw = (process.env.TRUST_PROXY || "false").trim().toLowerCase();
    if (raw === "false" || raw === "") return false;
    if (raw === "true") return true;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? false : n;
  })(),
};

export = env;
