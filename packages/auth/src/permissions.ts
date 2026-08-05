/**
 * What a principal may do, as capabilities rather than job titles.
 *
 * `restrictTo("admin")` answers the wrong question. It asks who someone *is*,
 * when the thing that matters is what they may *do* — and the two stop lining
 * up the moment a real insurance operation appears, with underwriters, claims
 * adjusters, branch managers and compliance officers who each need a different
 * slice. Role-based checks then grow into long `includes` lists at every call
 * site, and the day a new role appears every one of them has to be found.
 *
 * Permissions invert that. Code asks for the capability it needs; roles are
 * just named bundles, and a new role is a data change rather than a code change.
 *
 * Named `resource.action` so the set stays greppable and self-describing.
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

  // Platform administration
  "staff.manage",
  "organization.manage",
  "audit.read",
  "platform.configure",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Roles are bundles. They carry no authority of their own — nothing in the
 * codebase is permitted to branch on a role name.
 *
 * `satisfies` rather than a type annotation, so each list keeps its literal
 * type and a typo in a permission name is a compile error here rather than a
 * silently missing capability at runtime.
 */
export const ROLE_PERMISSIONS = {
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

/** Flatten a set of roles into the capabilities they grant. */
export function permissionsForRoles(roles: readonly string[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    const bundle = ROLE_PERMISSIONS[role as RoleName];
    if (!bundle) continue; // Unknown role grants nothing. Fail closed.
    for (const permission of bundle) granted.add(permission);
  }
  return [...granted];
}

/**
 * The only sanctioned authorisation question.
 *
 * Takes the permission list rather than the principal so it can be used on both
 * sides of the wire — the server deciding, and the client deciding whether to
 * render a button. The client-side answer is a courtesy, never a control: the
 * service authorises every request regardless of what the UI chose to show.
 */
export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasAllPermissions(
  granted: readonly Permission[],
  required: readonly Permission[]
): boolean {
  return required.every((permission) => granted.includes(permission));
}
