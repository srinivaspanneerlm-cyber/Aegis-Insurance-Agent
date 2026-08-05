/**
 * Account lockout.
 *
 * The rate limiter in front of `/auth/login` bounds attempts *per IP*, which is
 * the wrong axis for the attack that matters: a list of stolen passwords tried
 * against one account from many addresses. This counts per account.
 *
 * The design tension is that a lockout is itself a denial of service — anyone
 * who knows a customer's email can lock them out by failing five times. So the
 * lock is short and it expires on its own; there is no state an attacker can
 * create that a customer has to phone somebody to undo.
 */
import { userRepository } from "../repositories";
import { auditService } from "../services/audit.service";

/** Failures tolerated before a lock. */
export const LOCKOUT_THRESHOLD = 8;

/**
 * How long a lock lasts.
 *
 * Fifteen minutes turns an online guessing attack from thousands of attempts an
 * hour into roughly thirty, which is the whole point — while a customer who has
 * genuinely forgotten which password they used gets back in over a cup of tea,
 * or immediately via a reset link, which is deliberately not blocked by this.
 */
export const LOCKOUT_DURATION_MS = 15 * 60_000;

export interface LockState {
  readonly locked: boolean;
  /** Null when not locked. */
  readonly until: Date | null;
}

export function lockStateOf(user: { lockedUntil: Date | null }): LockState {
  if (!user.lockedUntil || user.lockedUntil <= new Date()) return { locked: false, until: null };
  return { locked: true, until: user.lockedUntil };
}

/**
 * Record a failed sign-in and lock the account if it has now had too many.
 *
 * Best-effort: a bookkeeping write that fails must not turn a wrong password
 * into a server error, because the correct answer to a wrong password is
 * already known.
 */
export async function recordFailure(user: {
  id: string;
  failedLoginAttempts: number;
}): Promise<void> {
  const attempts = user.failedLoginAttempts + 1;
  const reached = attempts >= LOCKOUT_THRESHOLD;

  try {
    await userRepository.update(user.id, {
      failedLoginAttempts: attempts,
      ...(reached ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
    });
  } catch {
    return;
  }

  if (reached) {
    auditService.record({
      actorId: user.id,
      action: "auth.lockout.engaged",
      metadata: { attempts, durationMs: LOCKOUT_DURATION_MS },
    });
  }
}

/**
 * A successful sign-in clears the count.
 *
 * Only written when there is something to clear — the overwhelming majority of
 * sign-ins are already at zero, and an unconditional write would put a row
 * update on the hot path of every login for no benefit.
 */
export async function clearFailures(user: {
  id: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}): Promise<void> {
  if (user.failedLoginAttempts === 0 && user.lockedUntil === null) return;
  try {
    await userRepository.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
  } catch {
    /* bookkeeping only */
  }
}
