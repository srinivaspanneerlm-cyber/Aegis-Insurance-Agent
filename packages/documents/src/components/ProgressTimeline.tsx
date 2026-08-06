"use client";

import { cn } from "@aegis/utils";
import { PIPELINE_STAGES, type PipelineStageKey } from "../lib/types";

export interface ProgressTimelineProps {
  /** The stage reached. Null before anything has started. */
  current: PipelineStageKey | null;
  /** Marks the run as ended badly; every stage after `current` greys out. */
  failed?: boolean;
  /** Compact drops the descriptions — for a card rather than a detail panel. */
  compact?: boolean;
}

/**
 * The stages a document has passed through.
 *
 * An ordered list, not a spinner. A spinner says "wait"; this says what is
 * happening and what is left, which is the difference between a customer
 * waiting patiently and one refreshing the page.
 *
 * Rendered as an ordered list with `aria-current` on the active step, so a
 * screen reader hears position and progress rather than a wall of ticks. The
 * status is also announced once as text, because the visual sequence is
 * meaningless to somebody who cannot see it.
 */
export function ProgressTimeline({
  current,
  failed = false,
  compact = false,
}: ProgressTimelineProps) {
  const currentIndex = current ? PIPELINE_STAGES.findIndex((s) => s.key === current) : -1;

  return (
    <div>
      <p role="status" className="sr-only">
        {current
          ? `${PIPELINE_STAGES[currentIndex]?.label ?? current}${failed ? " — stopped" : ""}. Step ${currentIndex + 1} of ${PIPELINE_STAGES.length}.`
          : "Not started."}
      </p>

      <ol className={cn("flex flex-col", compact ? "gap-1.5" : "gap-3")}>
        {PIPELINE_STAGES.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const stalled = failed && active;

          return (
            <li
              key={stage.key}
              aria-current={active ? "step" : undefined}
              className="flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[0.5625rem] font-bold",
                  stalled
                    ? "border-danger bg-danger text-status-fg"
                    : done
                      ? "border-success bg-success text-status-fg"
                      : active
                        ? "border-brand text-brand"
                        : "border-line-strong text-content-muted"
                )}
              >
                {done ? "✓" : stalled ? "!" : index + 1}
              </span>

              <div className="min-w-0">
                <p
                  className={cn(
                    "text-caption",
                    active
                      ? "text-content font-semibold"
                      : done
                        ? "text-content-secondary"
                        : "text-content-muted"
                  )}
                >
                  {stage.label}
                </p>
                {!compact && (active || done) ? (
                  <p className="text-caption text-content-muted">{stage.description}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
