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
  CUSTOMER: [],

  /** Branch and support staff: work the pipeline, read customers, no deletion. */
  EMPLOYEE: [
    "policy.read",
    "policy.write",
    "lead.read",
    "lead.write",
    "customer.read",
    "analytics.read",
  ],

  /**
   * An organisation's own administrator. Broad authority over that
   * organisation's book of business — and none at all over the platform, which
   * is the distinction that keeps a customer of Aegis from becoming an operator
   * of it.
   */
  ENTERPRISE_ADMIN: [
    "policy.read",
    "policy.write",
    "policy.approve",
    "claim.read",
    "claim.assess",
    "claim.settle",
    "customer.read",
    "customer.write",
    "lead.read",
    "lead.write",
    "analytics.read",
    "audit.read",
    "staff.manage",
  ],

  /** Everything. Derived, so a permission added later is never withheld. */
  PLATFORM_ADMIN: PERMISSIONS,

  // ── Future roles ───────────────────────────────────────────────────────────
  // Declared now and granted to nobody yet. They exist so that the day one is
  // assigned is a data change rather than a code change, and so the staff
  // application and this API cannot disagree about what a role name means.
  SUPPORT: ["customer.read", "policy.read", "claim.read", "lead.read"],
  CLAIMS: ["claim.read", "claim.assess", "claim.settle", "customer.read", "policy.read"],
  OPERATIONS: ["policy.read", "policy.write", "lead.read", "lead.write", "analytics.read"],
  COMPLIANCE: ["audit.read", "policy.read", "claim.read", "customer.read"],
  /** An external broker or agency. Read-only, and only what they were sent. */
  PARTNER: ["policy.read", "lead.read"],
} as const satisfies Record<string, readonly Permission[]>;

export type RoleName = keyof typeof ROLE_PERMISSIONS;

export const ROLE_NAMES = Object.keys(ROLE_PERMISSIONS) as readonly RoleName[];

export const isRoleName = (value: unknown): value is RoleName =>
  typeof value === "string" && value in ROLE_PERMISSIONS;

/**
 * The role a realm gives someone by default.
 *
 * Registration only ever produces a CUSTOMER — the others are assigned by
 * somebody who already holds the authority to assign them. This table exists so
 * that "which role does a new EMPLOYEE start with" has an answer in one place
 * when staff provisioning arrives, rather than being decided at whichever call
 * site gets there first.
 */
export const DEFAULT_ROLE_FOR_REALM = {
  CUSTOMER: "CUSTOMER",
  EMPLOYEE: "EMPLOYEE",
  ENTERPRISE: "ENTERPRISE_ADMIN",
  PLATFORM: "PLATFORM_ADMIN",
} as const satisfies Record<string, RoleName>;

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
