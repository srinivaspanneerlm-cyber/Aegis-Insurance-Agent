/**
 * Where a customer lands after authenticating.
 *
 * Pure, so the rule is testable and stated in exactly one place — the three
 * sign-in paths (password, Google, registration) would otherwise each carry
 * their own copy.
 *
 * This is the customer portal: it has no administrative surface, so there is no
 * role branch here. Staff accounts still exist in the backend and are still
 * enforced by its RBAC — they simply have nothing to reach from this app, and
 * belong in the separate Enterprise Admin application.
 */

import { safeNextPath } from "./routes";

export interface RoutableUser {
  /** ISO timestamp, or null/undefined when onboarding is unfinished. */
  onboardedAt?: string | null;
}

export const ONBOARDING_ROUTE = "/onboarding";
export const CUSTOMER_HOME = "/consumer-dashboard";

export function routeForUser(user: RoutableUser): string {
  return user.onboardedAt ? CUSTOMER_HOME : ONBOARDING_ROUTE;
}

/**
 * Where to send a customer who has just signed in, honouring the page they were
 * originally trying to reach.
 *
 * When the route guard turns someone away it records their destination as
 * `?next=`. Signing in should finish that journey rather than abandoning them
 * on the dashboard. Onboarding still wins over any requested destination — a
 * customer who has not finished it cannot use the page they asked for anyway.
 *
 * `requestedNext` is untrusted (it arrives in a URL), so it goes through
 * `safeNextPath` before it is used.
 */
export function destinationAfterAuth(
  user: RoutableUser,
  requestedNext: string | null | undefined
): string {
  if (needsOnboarding(user)) return ONBOARDING_ROUTE;
  return safeNextPath(requestedNext) ?? CUSTOMER_HOME;
}

/**
 * `destinationAfterAuth` against the address bar.
 *
 * Reading `?next=` here rather than threading it through every sign-in call
 * means all four ways in — password, Google, registration, and landing on the
 * sign-in page while already signed in — honour it without any of them having
 * to know it exists.
 */
export function destinationForCurrentUrl(user: RoutableUser): string {
  const requestedNext =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("next");
  return destinationAfterAuth(user, requestedNext);
}

/** True when this customer still owes us the onboarding answers. */
export function needsOnboarding(user: RoutableUser | null): boolean {
  return !!user && !user.onboardedAt;
}
