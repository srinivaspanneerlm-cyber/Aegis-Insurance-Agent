/**
 * What a signed-in person may do, as capabilities rather than job titles.
 *
 * `restrictTo("admin", "superadmin")` asks the wrong question. It asks who
 * someone *is*, when the thing that matters is what they may *do* — and the two
 * stop lining up the moment a real insurance operation appears, with
 * underwriters, claims adjusters, branch managers and compliance officers who
 * each need a different slice. Role checks then grow into long lists repeated at
 * every route, and the day a new role appears, every one of them has to be
 * found. Miss one and the failure is silent and in the wrong direction.
 *
 * Permissions invert that. A route names the capability it needs; roles are just
 * named bundles, and adding a role becomes a change to this table rather than a
 * change to every route file.
 *
 * Named `resource.action` so the whole set stays greppable.
 *
 * This mirrors `packages/auth/src/permissions.ts`, which is the agreed contract
 * for the enterprise staff application. It is a superset: the bundles the
 * contract declares are reproduced verbatim, plus the capabilities this API's
 * own routes actually need today. Sprint 2 converges the two.
 */

export const PERMISSIONS = [
  // Policy lifecycle
  "policy.read",
  "policy.write",
  "policy.approve",

  // Claims lifecycle
  "claim.read",
  "claim.assess",
  "claim.settle",

  // Customer records
  "customer.read",
  "customer.write",

  // Sales pipeline — this API's own routes
  "lead.read",
  "lead.write",
  "lead.delete",

  // Product catalogue
  "company.write",

  // Platform administration
  "analytics.read",
  "staff.manage",
  "organization.manage",
  "audit.read",
  "platform.configure",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Roles are bundles. They carry no authority of their own — nothing outside
 * this file is permitted to branch on a role name.
 *
 * `satisfies` rather than a type annotation, so each list keeps its literal type
 * and a typo in a permission name is a compile error here rather than a silently
 * missing capability at runtime.
 */
export const ROLE_PERMISSIONS = {
  /**
   * Deliberately empty, and that is not an oversight.
   *
   * A customer's authority over their own policies, chats and documents does
   * not come from a permission — it comes from every query being scoped by
   * `userId`. Granting them a capability here would make that scoping look
   * optional, which is exactly the mistake that leaks one customer's records to
   * another.
   */
  customer: [],

  admin: [
    "policy.read",
    "policy.write",
    "lead.read",
    "lead.write",
    "customer.read",
    "analytics.read",
  ],

  /** Everything. The bundle is derived so a new permission is never forgotten. */
  superadmin: PERMISSIONS,

  // ── Bundles from the staff contract (packages/auth), not yet reachable ──────
  // No live route grants these roles today; they are here so the staff
  // application and this API cannot disagree about what a role means.
  "claims-adjuster": ["claim.read", "claim.assess", "customer.read", "policy.read"],
  underwriter: ["policy.read", "policy.write", "policy.approve", "customer.read"],
  "branch-manager": [
    "policy.read",
    "policy.approve",
    "claim.read",
    "claim.settle",
    "customer.read",
    "customer.write",
    "staff.manage",
  ],
  "compliance-officer": ["audit.read", "policy.read", "claim.read", "customer.read"],
  "platform-admin": ["staff.manage", "organization.manage", "audit.read", "platform.configure"],
} as const satisfies Record<string, readonly Permission[]>;

export type RoleName = keyof typeof ROLE_PERMISSIONS;

/**
 * The capabilities a role grants.
 *
 * An unrecognised role grants nothing. Failing closed matters here more than
 * almost anywhere else: a typo in a role name, or a role written straight into
 * the database, must not be able to open a door.
 */
export function permissionsForRole(role: string | null | undefined): readonly Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as RoleName] ?? [];
}

/** The only sanctioned authorisation question. */
export function roleHasPermission(role: string | null | undefined, required: Permission): boolean {
  return permissionsForRole(role).includes(required);
}
