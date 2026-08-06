"use client";

import { useId, useState } from "react";
import { cn } from "@aegis/utils";
import { ExplanationPanel } from "./ExplanationPanel";
import { DOMAIN_LABEL, URGENCY_META, formatRupees, type Recommendation } from "../lib/types";

export interface RecommendationCardProps {
  recommendation: Recommendation;
  /** Open on first render. Used for the top recommendation on a report. */
  defaultExpanded?: boolean;
  onAct?: (recommendation: Recommendation) => void;
  actionLabel?: string;
}

const TONE_CLASS = {
  danger: "border-danger/40 text-danger",
  warning: "border-warning/40 text-warning",
  info: "border-info/40 text-info",
  neutral: "border-line/60 text-content-muted",
} as const;

/**
 * One recommendation, with its reasoning one click away.
 *
 * The explanation is collapsed rather than absent, and collapsed rather than
 * behind a link to another page. A customer deciding whether to spend money
 * should be able to read the reasoning without losing the thing they are
 * reasoning about.
 *
 * Implemented as a real `<button>` driving `aria-expanded` and `aria-controls`
 * rather than a `<details>` element, because the trigger sits in the card
 * header alongside other content and `<details>` would force the summary to own
 * that whole row.
 */
export function RecommendationCard({
  recommendation,
  defaultExpanded = false,
  onAct,
  actionLabel = "Talk to an advisor",
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const urgency = URGENCY_META[recommendation.urgency];
  const premium = recommendation.estimatedAnnualPremium;

  return (
    <article className="rounded-card border-line/50 bg-surface-raised/30 border">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-content-muted">{DOMAIN_LABEL[recommendation.domain]}</p>
            <h3 className="text-body text-content mt-0.5 font-semibold text-pretty">
              {recommendation.headline}
            </h3>
          </div>

          <span
            className={cn(
              "rounded-pill shrink-0 border px-2.5 py-1 text-[0.6875rem] font-semibold",
              TONE_CLASS[urgency.tone]
            )}
          >
            {urgency.label}
          </span>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {recommendation.suggestedSumInsured !== null ? (
            <div>
              <dt className="text-caption text-content-muted">Cover suggested</dt>
              <dd className="text-body-sm text-content font-medium">
                {formatRupees(recommendation.suggestedSumInsured)}
              </dd>
            </div>
          ) : null}

          {premium ? (
            <div>
              <dt className="text-caption text-content-muted">Roughly, per year</dt>
              <dd className="text-body-sm text-content font-medium">
                {formatRupees(premium.low)} – {formatRupees(premium.high)}
                {/* Labelled at the point of display, not only in the
                    explanation. Somebody who never expands the panel must still
                    know this is not a quote. */}
                <span className="text-caption text-content-muted ml-1.5 font-normal">
                  estimate, not a quote
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="text-body-sm text-content-secondary text-pretty">
          {recommendation.explanation.why}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="focus-ring rounded-control border-line/60 text-caption text-content hover:border-line border px-3 py-1.5 font-medium transition-colors"
          >
            {expanded ? "Hide the reasoning" : "Why are we suggesting this?"}
          </button>

          {onAct ? (
            <button
              type="button"
              onClick={() => onAct(recommendation)}
              className="focus-ring rounded-control bg-brand text-brand-fg hover:bg-brand-hover text-caption px-3 py-1.5 font-semibold transition-colors"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>

      {/* Kept in the DOM and hidden, so an in-page find reaches the reasoning
          and so expanding does not re-run the animation-free layout. */}
      <div id={panelId} hidden={!expanded} className="border-line/40 border-t px-5 py-5">
        <ExplanationPanel explanation={recommendation.explanation} />

        <section className="border-line/40 mt-5 border-t pt-4">
          <h4 className="text-caption text-content-muted mb-1.5 font-semibold tracking-wide uppercase">
            What this kind of cover pays for
          </h4>
          <ul className="flex flex-col gap-1.5">
            {recommendation.coverage.map((item) => (
              <li key={item} className="text-body-sm text-content-secondary text-pretty">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-caption text-content-muted mt-3 text-pretty">
            <span className="text-content-secondary font-medium">Who it suits: </span>
            {recommendation.idealFor}
          </p>
        </section>
      </div>
    </article>
  );
}
