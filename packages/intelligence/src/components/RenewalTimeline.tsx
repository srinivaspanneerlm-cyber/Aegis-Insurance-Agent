"use client";

import { cn } from "@aegis/utils";
import { DOMAIN_LABEL, SEVERITY_META, type RenewalForecast } from "../lib/types";

export interface RenewalTimelineProps {
  renewals: RenewalForecast[];
}

const TONE_DOT = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-line",
} as const;

/**
 * Renewals ahead, soonest first.
 *
 * An overdue renewal is shown first and in words — "12 days ago" rather than
 * "-12 days". A negative number in a countdown is the kind of thing a person
 * skims past, and this is the single most expensive item on the page to miss.
 */
export function RenewalTimeline({ renewals }: RenewalTimelineProps) {
  if (renewals.length === 0) {
    return (
      <p className="text-body-sm text-content-secondary rounded-card border-line/50 border border-dashed p-6 text-center">
        No renewals are recorded. Add a policy you already hold and we will track it for you.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {renewals.map((renewal) => {
        const severity = SEVERITY_META[renewal.priority];
        const overdue = renewal.daysAway < 0;

        return (
          <li
            key={renewal.policyId}
            className="rounded-card border-line/50 bg-surface-raised/20 flex gap-3 border p-4"
          >
            <span
              aria-hidden="true"
              className={cn("rounded-pill mt-1.5 h-2 w-2 shrink-0", TONE_DOT[severity.tone])}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body-sm text-content font-medium">
                  {DOMAIN_LABEL[renewal.domain]}
                </p>
                <p
                  className={cn(
                    "text-caption font-medium",
                    overdue ? "text-danger" : "text-content-secondary"
                  )}
                >
                  {overdue
                    ? `Due ${Math.abs(renewal.daysAway)} days ago`
                    : renewal.daysAway === 0
                      ? "Due today"
                      : `In ${renewal.daysAway} days`}
                </p>
              </div>

              <p className="text-caption text-content-muted mt-0.5">
                {new Date(renewal.renewalDate).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {" · we will remind you from "}
                {new Date(renewal.reminderOn).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </p>

              <p className="text-caption text-content-secondary mt-1.5 text-pretty">
                {renewal.reminderRationale}
              </p>

              {renewal.improvements.length > 0 ? (
                <details className="mt-2">
                  <summary className="focus-ring text-caption text-brand cursor-pointer rounded font-medium">
                    {renewal.improvements.length} thing
                    {renewal.improvements.length === 1 ? "" : "s"} worth changing at renewal
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1.5 pl-1">
                    {renewal.improvements.map((item) => (
                      <li key={item} className="text-caption text-content-secondary text-pretty">
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
