/**
 * What the signed-in customer may do, as the API told us.
 *
 * The important thing about this file is what it deliberately does not do: it
 * holds **no table** mapping roles to capabilities. The server sends the
 * resolved list with the session, and this only asks whether a capability is in
 * it. A copy of the rules here would be a second place for them to be right,
 * and the two would drift — usually quietly, and usually in the direction of
 * showing someone a control they cannot actually use.
 *
 * The client's answer is a **courtesy, never a control**. Hiding a button is a
 * kindness to the person using the screen, not a security boundary; the API
 * authorises every request on its own regardless of what the UI chose to
 * render. Nothing here should ever be the only thing standing between a
 * customer and someone else's records.
 */

/**
 * The capability names the API can send.
 *
 * A union rather than `string` so a typo in a `<Can permission="...">` is a
 * compile error instead of a control that silently never appears. These names
 * are compile-time only — the values always come from the server.
 */
export type Permission =
  | "policy.read"
  | "policy.write"
  | "policy.approve"
  | "claim.read"
  | "claim.assess"
  | "claim.settle"
  | "customer.read"
  | "customer.write"
  | "lead.read"
  | "lead.write"
  | "lead.delete"
  | "company.write"
  | "analytics.read"
  | "staff.manage"
  | "organization.manage"
  | "audit.read"
  | "platform.configure";

/**
 * Whether a granted set covers a capability.
 *
 * Undefined grants are treated as none, not as "not yet known". While the boot
 * probe is still in flight there is no session to speak of, and rendering an
 * administrative control on the optimistic assumption that one is coming is the
 * wrong way to be wrong.
 */
export function hasPermission(
  granted: readonly string[] | null | undefined,
  required: Permission
): boolean {
  return granted?.includes(required) ?? false;
}

/** Whether a granted set covers every capability listed. */
export function hasAllPermissions(
  granted: readonly string[] | null | undefined,
  required: readonly Permission[]
): boolean {
  return required.every((permission) => hasPermission(granted, permission));
}

/** Whether a granted set covers at least one of the capabilities listed. */
export function hasAnyPermission(
  granted: readonly string[] | null | undefined,
  required: readonly Permission[]
): boolean {
  return required.some((permission) => hasPermission(granted, permission));
}
