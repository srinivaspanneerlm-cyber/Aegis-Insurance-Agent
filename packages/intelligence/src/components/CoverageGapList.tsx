"use client";

import { useId, useState } from "react";
import { cn } from "@aegis/utils";
import { ExplanationPanel } from "./ExplanationPanel";
import {
  DOMAIN_LABEL,
  GAP_KIND_LABEL,
  SEVERITY_META,
  formatRupees,
  type CoverageGap,
} from "../lib/types";

export interface CoverageGapListProps {
  gaps: CoverageGap[];
}

const TONE_CLASS = {
  danger: "border-danger/40 text-danger",
  warning: "border-warning/40 text-warning",
  info: "border-info/40 text-info",
  neutral: "border-line/60 text-content-muted",
} as const;

/**
 * What is missing, too small, or paid for twice.
 *
 * A duplicate is rendered exactly like a shortfall — same weight, same
 * prominence, same expandable reasoning. Presenting "you can cancel one of
 * these" less prominently than "you should buy more" would quietly turn an
 * analysis into a funnel.
 */
export function CoverageGapList({ gaps }: CoverageGapListProps) {
  if (gaps.length === 0) {
    return (
      <p className="text-body-sm text-content-secondary rounded-card border-line/50 border border-dashed p-6 text-center">
        Nothing is missing from your cover, based on what we know about you.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {gaps.map((gap) => (
        // Domain and kind together identify a gap: the engine emits at most one
        // of each kind per domain, so this is stable across re-analysis.
        <li key={`${gap.domain}-${gap.kind}`}>
          <GapRow gap={gap} />
        </li>
      ))}
    </ul>
  );
}

function GapRow({ gap }: { gap: CoverageGap }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const severity = SEVERITY_META[gap.severity];

  return (
    <article className="rounded-card border-line/50 bg-surface-raised/20 border">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-caption text-content-muted">
              {DOMAIN_LABEL[gap.domain]} · {GAP_KIND_LABEL[gap.kind]}
            </p>
            <p className="text-body-sm text-content mt-0.5 font-medium text-pretty">
              {gap.summary}
            </p>
          </div>
          <span
            className={cn(
              "rounded-pill shrink-0 border px-2.5 py-1 text-[0.6875rem] font-semibold",
              TONE_CLASS[severity.tone]
            )}
          >
            {severity.label}
          </span>
        </div>

        {gap.exposureValue !== null ? (
          <p className="text-caption text-content-secondary">
            {gap.kind === "DUPLICATE" ? "Possible saving" : "Amount at stake"}:{" "}
            <span className="text-content font-medium">{formatRupees(gap.exposureValue)}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="focus-ring rounded-control text-caption text-brand w-fit font-medium"
        >
          {expanded ? "Hide the reasoning" : "Why do we say this?"}
        </button>
      </div>

      <div id={panelId} hidden={!expanded} className="border-line/40 border-t px-4 py-4">
        <ExplanationPanel explanation={gap.explanation} />
      </div>
    </article>
  );
}
