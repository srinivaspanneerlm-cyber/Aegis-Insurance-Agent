/**
 * Centralized runtime configuration for the frontend.
 *
 * All environment-derived endpoints live here so there is a single source of
 * truth. Previously the API base URL was duplicated across `services/api.ts`
 * and the streaming hook, which risked the two drifting apart. Import from this
 * module instead of re-reading `process.env` or hardcoding URLs in components.
 *
 * Defaults intentionally match the pre-existing inline fallbacks so behaviour
 * is unchanged when the env vars are unset (local dev).
 */

/** Node/Express REST API base (auth, leads, policies, chat bridge). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// No AI-engine base here on purpose. The browser reaches the advisor stream
// through the Node backend, which authenticates the customer and tells the
// engine who they are; a constant pointing straight at the engine is an
// invitation to go around that.
