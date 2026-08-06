"use client";

import { DOMAIN_LABEL, type IntelligenceReport } from "../lib/types";

export interface NextBestActionProps {
  action: IntelligenceReport["nextBestAction"];
  completeness: number;
}

/**
 * The one thing to do next.
 *
 * Deliberately the only thing above the fold. A report that opens with seven
 * findings is read as a wall of demands and closed; a single sentence with its
 * reason is read. Everything else on the page is still there for anyone who
 * wants it.
 *
 * `role="status"` rather than `role="alert"` — this updates when a report is
 * regenerated, and an assertive interruption on every refresh would be
 * hostile to somebody using a screen reader.
 */
export function NextBestAction({ action, completeness }: NextBestActionProps) {
  return (
    <section
      role="status"
      className="rounded-card border-brand/30 bg-brand/5 border p-5"
      aria-label="What to do next"
    >
      <p className="text-caption text-brand font-semibold tracking-wide uppercase">
        What to do next
      </p>
      <h2 className="text-h3 text-content mt-1.5 font-semibold text-pretty">{action.summary}</h2>
      <p className="text-body-sm text-content-secondary mt-2 text-pretty">{action.rationale}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {action.domain ? (
          <span className="rounded-pill border-line/60 text-caption text-content-secondary border px-2.5 py-1">
            {DOMAIN_LABEL[action.domain]}
          </span>
        ) : null}

        {/* Completeness is shown here rather than as a separate widget, because
            it is only meaningful next to the advice it limits. */}
        <span className="text-caption text-content-muted">
          Based on a profile that is {completeness}% complete
        </span>
      </div>
    </section>
  );
}
