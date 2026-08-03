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

export interface RoutableUser {
  /** ISO timestamp, or null/undefined when onboarding is unfinished. */
  onboardedAt?: string | null;
}

export const ONBOARDING_ROUTE = "/onboarding";
export const CUSTOMER_HOME = "/consumer-dashboard";

export function routeForUser(user: RoutableUser): string {
  return user.onboardedAt ? CUSTOMER_HOME : ONBOARDING_ROUTE;
}

/** True when this customer still owes us the onboarding answers. */
export function needsOnboarding(user: RoutableUser | null): boolean {
  return !!user && !user.onboardedAt;
}
