/**
 * Where a user lands after authenticating.
 *
 * Pure, so the rule is testable and stated in exactly one place — the three
 * sign-in paths (password, Google, registration) previously each carried their
 * own copy of the role check, and now that first-time onboarding is part of the
 * decision, three copies would be three chances to disagree.
 */

export interface RoutableUser {
  role: string;
  /** ISO timestamp, or null/undefined when onboarding is unfinished. */
  onboardedAt?: string | null;
}

export const ADMIN_ROLES = ["admin", "superadmin"];

export const isAdminRole = (role: string): boolean => ADMIN_ROLES.includes(role);

export const ONBOARDING_ROUTE = "/onboarding";
export const CUSTOMER_HOME = "/consumer-dashboard";
export const ADMIN_HOME = "/admin-dashboard";

/**
 * Onboarding is a customer journey: staff accounts go straight to their console
 * rather than being asked which insurance they are shopping for.
 */
export function routeForUser(user: RoutableUser): string {
  if (isAdminRole(user.role)) return ADMIN_HOME;
  return user.onboardedAt ? CUSTOMER_HOME : ONBOARDING_ROUTE;
}

/** True when this user still owes us the onboarding answers. */
export function needsOnboarding(user: RoutableUser | null): boolean {
  return !!user && !isAdminRole(user.role) && !user.onboardedAt;
}
