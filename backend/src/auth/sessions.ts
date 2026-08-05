/**
 * Authentication sittings.
 *
 * A refresh token keeps a session alive; this is the session itself. The
 * distinction earns its place the moment somebody asks either of the two
 * questions a bag of rotating tokens cannot answer legibly: "what is signed in
 * to my account right now", and "sign me out of everything except here".
 *
 * Rotation means the credential changes constantly while the sitting does not,
 * which is exactly why the sitting needs its own identity.
 */
import { authSessionRepository, refreshTokenRepository } from "../repositories";
import { auditService } from "../services/audit.service";
import { policyForRealm, type Realm } from "./realms";
import type { RequestContext } from "./loginHistory";

export type RevocationReason =
  | "LOGOUT"
  | "LOGOUT_ALL"
  | "REPLAY"
  | "PASSWORD_CHANGED"
  | "IDLE"
  | "ADMIN";

/**
 * Open a sitting.
 *
 * The realm is copied in rather than read through to the user, so the answer to
 * "which portal was this for" cannot change retroactively when somebody's realm
 * is changed. Its lifetime comes from the realm's policy — a platform operator's
 * sitting is hours where a customer's is weeks.
 */
export async function openSession(input: {
  userId: string;
  realm: Realm;
  context?: RequestContext;
}) {
  const policy = policyForRealm(input.realm);

  return authSessionRepository.create({
    userId: input.userId,
    realm: input.realm,
    ipAddress: input.context?.ipAddress ?? null,
    userAgent: input.context?.userAgent ?? null,
    expiresAt: new Date(Date.now() + policy.sessionTtlMs),
  });
}

/** Note that a sitting is still in use. Best-effort; it is a timestamp. */
export async function touchSession(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId) return;
  try {
    await authSessionRepository.touch(sessionId);
  } catch {
    /* bookkeeping only */
  }
}

/**
 * Close a sitting and revoke the credentials that belong to it.
 *
 * Both halves matter. Revoking the session without its refresh tokens leaves
 * live credentials pointing at a closed sitting — which would renew perfectly
 * well, and the "signed out" would be cosmetic.
 */
export async function closeSession(
  sessionId: string,
  reason: RevocationReason
): Promise<void> {
  try {
    await authSessionRepository.revoke(sessionId, reason);
    await refreshTokenRepository.revokeForSession(sessionId);
  } catch {
    /* a sitting that cannot be found is already closed as far as anyone cares */
  }
}

/**
 * End everything for an account.
 *
 * Used by the replay sweep and by a password change. Returns how many sittings
 * ended, which is what makes the audit entry worth reading afterwards.
 */
export async function closeAllSessions(
  userId: string,
  reason: RevocationReason
): Promise<number> {
  const ended = await authSessionRepository.revokeAllForUser(userId, reason);
  await refreshTokenRepository.revokeAllForUser(userId);
  auditService.record({
    actorId: userId,
    action: "auth.session.revoked_all",
    metadata: { reason, endedSessions: ended },
  });
  return ended;
}

/**
 * What is signed in to this account right now.
 *
 * Deliberately returns no token material — only where and when. This is
 * customer-facing data, and a session list that leaked anything usable would be
 * a worse hazard than the one it exists to address.
 */
export async function listSessions(userId: string) {
  const sessions = await authSessionRepository.listActive(userId);
  return sessions.map((session) => ({
    id: session.id,
    realm: session.realm,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  }));
}
