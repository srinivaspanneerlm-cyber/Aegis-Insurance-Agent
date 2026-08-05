import type { SessionId } from "@aegis/shared-types";
import type { Principal } from "./principal";

/**
 * Session policy, stated as data.
 *
 * Customers and staff need different answers to the same four questions, and
 * writing those answers here — rather than scattering them across middleware —
 * means the difference is reviewable in one place. It is also the reason the
 * two principal kinds exist: one `User` table cannot hold both of these
 * policies at once.
 */
export interface SessionPolicy {
  /** How long an access credential is good for. */
  accessTokenTtlMs: number;
  /** How long the session may be renewed for, in total. */
  refreshTtlMs: number;
  /** Sign out after this much inactivity; null disables the idle timeout. */
  idleTimeoutMs: number | null;
  /** Whether a second factor is required to establish the session. */
  requiresMfa: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Long-lived and forgiving. Many of these customers are on a shared or borrowed
 * device, which is what the idle timeout is for — but the session itself lasts,
 * because being asked to sign in again mid-application is how people abandon
 * one.
 */
export const CUSTOMER_SESSION_POLICY: SessionPolicy = {
  accessTokenTtlMs: 15 * MINUTE,
  refreshTtlMs: 30 * DAY,
  idleTimeoutMs: 30 * MINUTE,
  requiresMfa: false,
};

/**
 * Short, and second-factored. A staff session can read other people's records,
 * so the trade-off runs the other way: the inconvenience of signing in again is
 * cheaper than the exposure of a session left open on an office machine.
 */
export const STAFF_SESSION_POLICY: SessionPolicy = {
  accessTokenTtlMs: 10 * MINUTE,
  refreshTtlMs: 8 * HOUR,
  idleTimeoutMs: 15 * MINUTE,
  requiresMfa: true,
};

export const policyFor = (principal: Principal): SessionPolicy =>
  principal.kind === "staff" ? STAFF_SESSION_POLICY : CUSTOMER_SESSION_POLICY;

export interface Session {
  readonly id: SessionId;
  readonly principal: Principal;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * What the two realms are called on the wire.
 *
 * Separate cookie names are not cosmetic. Sharing one means a customer's
 * credential is presented to staff endpoints on every request, leaving a string
 * comparison as the only thing standing between the two. Different names mean
 * the staff API never even receives a customer's session.
 */
export const SESSION_COOKIES = {
  customer: "aegis_session",
  staff: "aegis_staff_session",
} as const;

export type SessionRealm = keyof typeof SESSION_COOKIES;
