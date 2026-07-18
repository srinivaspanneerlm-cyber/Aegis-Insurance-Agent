/**
 * Centralised application constants & feature flags.
 *
 * Single source of truth for tunable values that were previously scattered as
 * magic numbers across middleware, controllers and services. Values mirror the
 * existing behaviour exactly — wiring these in changes nothing at runtime, it
 * just makes the knobs discoverable and overridable via environment variables.
 */

const num = (name: string, fallback: number): number => {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isNaN(v) ? fallback : v;
};
const bool = (name: string, fallback: boolean): boolean => {
  const v = process.env[name];
  return v !== undefined ? v.toLowerCase() === "true" : fallback;
};

// ── Rate limiting (mirrors config/security.js) ───────────────────────────────
export const RATE_LIMITS = {
  API: { windowMs: num("RL_API_WINDOW_MS", 15 * 60 * 1000), max: num("RL_API_MAX", 100) },
  AUTH: { windowMs: num("RL_AUTH_WINDOW_MS", 60 * 60 * 1000), max: num("RL_AUTH_MAX", 20) },
  AI: { windowMs: num("RL_AI_WINDOW_MS", 60 * 1000), max: num("RL_AI_MAX", 20) },
  SOCKET: { windowMs: num("RL_SOCKET_WINDOW_MS", 60 * 1000), max: num("RL_SOCKET_MAX", 20) },
};

// ── Pagination ───────────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_LIMIT: num("PAGE_DEFAULT_LIMIT", 20),
  MAX_LIMIT: num("PAGE_MAX_LIMIT", 100),
};

// ── Conversation / history caps ──────────────────────────────────────────────
export const HISTORY = {
  AI_CONTEXT_TURNS: num("HISTORY_AI_CONTEXT_TURNS", 8), // recent turns sent to the AI
  CHAT_PAGE_MAX: num("HISTORY_CHAT_PAGE_MAX", 200), // max chat rows returned per read
};

// ── AI microservice client ───────────────────────────────────────────────────
export const AI_CLIENT = {
  TIMEOUT_MS: num("AI_TIMEOUT_MS", 45000),
  RETRIES: num("AI_RETRIES", 2),
  RETRY_BASE_DELAY_MS: num("AI_RETRY_BASE_DELAY_MS", 300),
};

// ── Auth / hashing ───────────────────────────────────────────────────────────
export const AUTH = {
  BCRYPT_ROUNDS: num("BCRYPT_ROUNDS", 12),
};

// ── Uploads ──────────────────────────────────────────────────────────────────
export const UPLOADS = {
  MAX_BYTES: num("UPLOAD_MAX_BYTES", 10 * 1024 * 1024),
  MAX_FILES: num("UPLOAD_MAX_FILES", 1),
};

// ── Cache TTLs (seconds) ─────────────────────────────────────────────────────
export const CACHE_TTL = {
  POLICIES: num("CACHE_TTL_POLICIES", 60),
  COMPANIES: num("CACHE_TTL_COMPANIES", 120),
  DEFAULT: num("CACHE_TTL_DEFAULT", 30),
};

// ── Lead lifecycle ───────────────────────────────────────────────────────────
export const LEADS = {
  AUTO_QUALIFY_DELAY_MS: num("LEAD_AUTO_QUALIFY_DELAY_MS", 5000),
};

// ── Feature flags — flip behaviour on/off without code changes ───────────────
export const FEATURES = {
  COMPRESSION: bool("FEATURE_COMPRESSION", true),
  RESPONSE_CACHE: bool("FEATURE_RESPONSE_CACHE", true),
  BACKGROUND_JOBS: bool("FEATURE_BACKGROUND_JOBS", true),
};
