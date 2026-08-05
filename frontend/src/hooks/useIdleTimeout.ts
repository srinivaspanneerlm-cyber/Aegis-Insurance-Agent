"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  idleStateAt,
  type IdlePhase,
} from "@/lib/session-lifecycle";

/**
 * How often we ask whether the session has gone idle.
 *
 * One second, because the countdown is shown to the customer and a coarser tick
 * would visibly stutter. The work per tick is a clock read and a subtraction.
 */
const TICK_MS = 1000;

/**
 * How often activity is written to shared storage.
 *
 * Every keystroke would mean a `localStorage` write per keystroke. Five seconds
 * of granularity costs nothing against a thirty-minute timeout and keeps typing
 * off the storage path.
 */
const ACTIVITY_WRITE_MS = 5000;

/**
 * What counts as the customer being present.
 *
 * Deliberately includes scrolling and touch: reading a policy comparison
 * without clicking anything is the most ordinary thing a customer does here,
 * and it must not look like absence. `visibilitychange` catches the return to
 * a tab that was left in the background.
 */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "focus"] as const;

interface Options {
  /** Only runs where a session is actually at risk — see the caller. */
  enabled: boolean;
  /** Called once when the session has been idle too long. */
  onExpire: () => void;
  timeoutMs?: number;
  warningMs?: number;
}

interface Result {
  phase: IdlePhase;
  msUntilSignOut: number;
  /** "Stay signed in" — the explicit answer to the countdown. */
  extend: () => void;
}

function readLastActivity(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastActivity(at: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(at));
  } catch {
    // Storage unavailable. The in-memory clock below still runs, so this tab
    // keeps its own timeout; it just stops sharing it with the others.
  }
}

/**
 * Ends a session that has been left unattended, after warning the customer.
 *
 * Activity is tracked through `localStorage` rather than per-tab state, so the
 * timeout follows the *person*: someone reading in one tab keeps their session
 * alive in all of them. Without that, a customer working happily in one tab
 * would be signed out by the three they had left open behind it.
 */
export function useIdleTimeout({
  enabled,
  onExpire,
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
}: Options): Result {
  const [state, setState] = useState<{ phase: IdlePhase; msUntilSignOut: number }>({
    phase: "active",
    msUntilSignOut: timeoutMs,
  });

  // Kept in refs so the activity listeners and the tick never need re-binding,
  // and so the effect below does not restart on every mouse move.
  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);
  const expiredRef = useRef<boolean>(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (now - lastWriteRef.current >= ACTIVITY_WRITE_MS) {
      lastWriteRef.current = now;
      writeLastActivity(now);
    }
  }, []);

  /** The customer said they are still here. Believe them, loudly. */
  const extend = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastWriteRef.current = now;
    writeLastActivity(now);
    setState({ phase: "active", msUntilSignOut: timeoutMs });
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      expiredRef.current = false;
      setState({ phase: "active", msUntilSignOut: timeoutMs });
      return;
    }

    // Arriving on a protected page is itself activity. Adopt whatever another
    // tab has recorded if it is more recent, so opening a second tab does not
    // reset a clock the first tab has been running.
    const now = Date.now();
    const shared = readLastActivity();
    lastActivityRef.current = Math.max(now, shared);
    lastWriteRef.current = now;
    writeLastActivity(lastActivityRef.current);
    expiredRef.current = false;

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", recordActivity);

    const tick = window.setInterval(() => {
      // The most recent of "this tab" and "any tab" — whichever proves the
      // customer was there last.
      const lastActivityAt = Math.max(lastActivityRef.current, readLastActivity());
      const next = idleStateAt(lastActivityAt, Date.now(), timeoutMs, warningMs);
      setState(next);

      if (next.phase === "expired" && !expiredRef.current) {
        // Once. The sign-out that follows unmounts half of what is on screen,
        // and firing it again on the next tick would race that.
        expiredRef.current = true;
        onExpireRef.current();
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(tick);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener("visibilitychange", recordActivity);
    };
  }, [enabled, recordActivity, timeoutMs, warningMs]);

  return { phase: state.phase, msUntilSignOut: state.msUntilSignOut, extend };
}
