"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, CircleHelp, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RenewalAssessment } from "@/services/api";

/**
 * The renewal band, at a glance.
 *
 * Colour is never the only signal. Each band gets its own icon and its own
 * words, because roughly one man in twelve cannot reliably tell the red pill
 * from the green one — and on this screen that difference is "your cover has
 * lapsed" against "nothing to do".
 *
 * The label comes from the server, which is where the band is decided. Nothing
 * here recomputes it from the date: two implementations of the same arithmetic
 * is how a customer ends up reading "Active" on a policy an operator is chasing.
 */

type Status = Extract<RenewalAssessment, { ok: true }>["status"];

const TONE: Record<Status, { className: string; Icon: typeof Clock }> = {
  ACTIVE: {
    className: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    Icon: CheckCircle2,
  },
  RENEWAL_COMING_SOON: {
    className: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
    Icon: CalendarClock,
  },
  ACTION_SOON: {
    className: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    Icon: Clock,
  },
  URGENT_RENEWAL: {
    className: "bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25",
    Icon: AlertTriangle,
  },
  POLICY_MAY_BE_EXPIRED: {
    className: "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25",
    Icon: AlertTriangle,
  },
};

const UNKNOWN = {
  className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10",
  Icon: CircleHelp,
};

export function RenewalStatusPill({
  renewal,
  className,
}: {
  renewal: RenewalAssessment;
  className?: string;
}) {
  const tone = renewal.ok ? TONE[renewal.status] : UNKNOWN;
  const { Icon } = tone;

  // "We don't know yet" is a state a customer reaches on their first visit, and
  // it needs a pill of its own rather than an empty space.
  const label = renewal.ok ? renewal.displayLabel : "Expiry date needed";

  return (
    <span
      data-testid="renewal-status-pill"
      data-status={renewal.ok ? renewal.status : "UNKNOWN"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        tone.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * "12 days left", "expires today", "expired 30 days ago".
 *
 * Spelled out rather than shown as a bare number with a label, because "0" next
 * to the word "days" is read as "no problem" about as often as it is read as
 * "today".
 */
export function daysRemainingLabel(renewal: RenewalAssessment): string | null {
  if (!renewal.ok) return null;
  const days = renewal.daysRemaining;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "Expired yesterday";
  return `Expired ${Math.abs(days)} days ago`;
}
