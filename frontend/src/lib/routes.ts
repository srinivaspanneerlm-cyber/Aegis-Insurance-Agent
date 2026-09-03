/**
 * Which parts of the portal require a session — stated once.
 *
 * Before this file the answer was scattered across five components, each with
 * its own copy of "if not signed in, go to /login". They ran at different
 * moments and raced the session probe, which is what made a signed-in customer
 * see the sign-in screen again. The route guard, the edge middleware and the
 * tests now all read the same list.
 */

/**
 * Set by the API alongside the session cookies; carries no credential, only the
 * fact that a session exists. Must match `SESSION_COOKIE_NAME` in
 * `backend/src/utils/cookies.ts`.
 */
export const SESSION_COOKIE_NAME = "aegis_session";

/** Where an unauthenticated visitor is sent. */
export const LOGIN_ROUTE = "/login";

/**
 * Aegis Consumer — the mobile-first guidance surface.
 *
 * Named here beside the other route constants so the nav, the tests and any
 * later redirect all read the same string. Already covered by the protected
 * prefixes below: `/consumer` was listed for the pages beneath it, and the
 * index simply had nothing to serve until now.
 *
 * Not `CUSTOMER_HOME`. Where a customer lands after signing in is a product
 * decision — `authRouting.ts` still sends them to the console — and changing it
 * would move every existing customer off the surface they use today.
 */
export const CONSUMER_HOME = "/consumer";

/**
 * Prefixes that require a session. A prefix covers the route and everything
 * beneath it, so a new sub-page is protected the day it is added.
 *
 * The public advisor is deliberately absent: anyone may talk to Aegis before
 * they have an account, and that is the funnel, not an oversight. Gating it
 * would be a change to how the business acquires customers, not a change to how
 * authentication works.
 */
export const PROTECTED_PREFIXES = [
  "/consumer-dashboard",
  "/consumer",
  "/dashboard",
  "/onboarding",
] as const;

/** True when this path may only be seen by a signed-in customer. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Sanitise a `?next=` destination before redirecting to it.
 *
 * A redirect target that arrives in a URL is attacker-controlled: left
 * unchecked it will happily send a customer who just typed their password to
 * another site that looks like this one. Only same-site absolute paths survive
 * — no scheme, no host, and no protocol-relative `//evil.example` (which a
 * browser reads as a different origin despite the leading slash).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}
