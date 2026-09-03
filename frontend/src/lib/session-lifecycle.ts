/**
 * When an unattended session ends, and how much warning the customer gets.
 *
 * Many of our customers are on a shared, borrowed or public device — a family
 * computer, an internet café, a relative's phone. A dashboard left open there
 * shows the next person their policies, their claims and their premiums. The
 * idle timeout is the answer to that, and it is the only reason this exists.
 *
 * The countdown is not decoration. Signing someone out with no warning, mid-way
 * through reading a comparison, reads as a fault in the site rather than a
 * safety measure — and the people most likely to be reading slowly are exactly
 * the ones we are here for. So they are told, in words, with a way to stay.
 */

/**
 * How long a session may sit untouched before it ends.
 *
 * Two hours, matched to the access-token lifetime so the two clocks do not
 * disagree. Longer than the shared-device risk above would argue for on its
 * own — worth revisiting before this ships to customers on public machines.
 */
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** How much of that is spent warning them first. */
export const IDLE_WARNING_MS = 60 * 1000;

/**
 * `active` — nothing to say. `warning` — the countdown is showing.
 * `expired` — the session is over and the customer must be signed out.
 */
export type IdlePhase = "active" | "warning" | "expired";

export interface IdleState {
  phase: IdlePhase;
  /** Milliseconds left before sign-out; 0 once expired. */
  msUntilSignOut: number;
}

/**
 * Work out where an idle session stands, from timestamps alone.
 *
 * Kept pure and free of timers so the boundaries can be tested directly rather
 * than by waiting thirty minutes.
 */
export function idleStateAt(
  lastActivityAt: number,
  now: number,
  timeoutMs: number = IDLE_TIMEOUT_MS,
  warningMs: number = IDLE_WARNING_MS
): IdleState {
  // A timestamp in the future means the clock moved backwards, or another tab
  // wrote a moment we have not reached yet. Either way the customer was active
  // more recently than we can prove, so treat them as present. Trusting the
  // arithmetic here would sign out someone who is sitting right there.
  const idleFor = Math.max(0, now - lastActivityAt);
  const msUntilSignOut = timeoutMs - idleFor;

  if (msUntilSignOut <= 0) return { phase: "expired", msUntilSignOut: 0 };
  if (msUntilSignOut <= warningMs) return { phase: "warning", msUntilSignOut };
  return { phase: "active", msUntilSignOut };
}

/**
 * Render a remaining time as `m:ss`.
 *
 * Rounded up, so a countdown reaches "0:01" and then sign-out — never showing
 * "0:00" while the customer still has a second to act on it.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
