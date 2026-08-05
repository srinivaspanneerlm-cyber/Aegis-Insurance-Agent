import type { CustomerId, OrganizationId, StaffId } from "@aegis/shared-types";
import type { Permission } from "./permissions";

/**
 * Who is making a request — as two different kinds of thing, not one thing with
 * a `role` string.
 *
 * This is the contract the platform has been missing. Today a customer and an
 * administrator are the same record in the same table, told apart by
 * `role: "customer" | "admin" | "superadmin"`. That makes a string comparison
 * the only barrier between public self-registration and administrative access,
 * and it forces one session policy onto two populations whose needs genuinely
 * conflict: a customer wants a long, forgiving session with a silent renewal,
 * while a staff member needs a short one with MFA behind it.
 *
 * Modelling them as separate principals means the compiler enforces the
 * distinction. A function that operates on staff cannot be handed a customer,
 * no matter what any string says. `role` cannot be escalated into staff access,
 * because staff access is a different type.
 *
 * These are types only — Sprint 1 deliberately ships no implementation. The
 * shape has to be agreed before anything is built on it, because this is the
 * one decision that is genuinely expensive to change later.
 */

export type Principal = CustomerPrincipal | StaffPrincipal;

export interface CustomerPrincipal {
  readonly kind: "customer";
  readonly id: CustomerId;
  readonly email: string;
  readonly displayName: string;
  /** Null until first-time onboarding is finished. */
  readonly onboardedAt: string | null;
}

export interface StaffPrincipal {
  readonly kind: "staff";
  readonly id: StaffId;
  readonly email: string;
  readonly displayName: string;
  /**
   * Staff always act inside an organisation — a branch, an agency, a partner.
   * It is not optional, because "which organisation's data may this person
   * see" is the question every staff-facing query has to answer, and an
   * optional field is one a query can forget.
   */
  readonly organizationId: OrganizationId;
  readonly roles: readonly string[];
  /**
   * Resolved at session creation from the roles above. Authorisation checks
   * read this, never the role names — see `permissions.ts`.
   */
  readonly permissions: readonly Permission[];
}

export const isCustomer = (principal: Principal): principal is CustomerPrincipal =>
  principal.kind === "customer";

export const isStaff = (principal: Principal): principal is StaffPrincipal =>
  principal.kind === "staff";
