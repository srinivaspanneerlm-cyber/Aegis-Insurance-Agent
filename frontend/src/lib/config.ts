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

const CONFIGURED_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Names that all mean "this machine". Which one the customer typed is their
 * choice, and the browser treats each as a separate site.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Point the API at the host the page itself was served from.
 *
 * A browser treats `localhost` and `127.0.0.1` as different sites even though
 * they are one machine. So a page opened on one of them, calling an API pinned
 * to the other, sends a cross-site request — and the session cookie is
 * `SameSite=Lax`, so it is withheld. Sign-in appears to succeed and then every
 * authenticated call 401s, which reads to the customer as being asked to log in
 * twice. Following the page's own hostname keeps the two same-site whichever
 * name was used.
 *
 * Only loopback names are rewritten. A deployment configured against a real API
 * host means it, and must keep talking to that host no matter what the page was
 * served from.
 *
 * Exported for tests; prefer the resolved `API_URL` below.
 */
export function resolveApiUrl(configured: string, pageHostname?: string): string {
  if (!pageHostname) return configured;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    // A relative base is already same-origin; nothing to rewrite.
    return configured;
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return configured;
  if (parsed.hostname === pageHostname) return configured;

  // Swap the host alone, so port, protocol and path survive exactly as set.
  const nextHost = parsed.port ? `${pageHostname}:${parsed.port}` : pageHostname;
  return configured.replace(`//${parsed.host}`, `//${nextHost}`);
}

/** Node/Express REST API base (auth, leads, policies, chat bridge). */
export const API_URL = resolveApiUrl(
  CONFIGURED_API_URL,
  typeof window === "undefined" ? undefined : window.location.hostname
);

// No AI-engine base here on purpose. The browser reaches the advisor stream
// through the Node backend, which authenticates the customer and tells the
// engine who they are; a constant pointing straight at the engine is an
// invitation to go around that.
