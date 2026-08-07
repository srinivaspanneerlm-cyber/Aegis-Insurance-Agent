"use client";

import { cn } from "@aegis/utils";
import { MEMORY_SOURCE_META, TONE_BORDER, timeAgo, type MemoryFact } from "../lib/types";

export interface MemoryTimelineProps {
  entries: MemoryFact[];
  /** Set when showing one key's history rather than a mixed feed. */
  forKey?: string;
  emptyMessage?: string;
}

/**
 * How what the platform believes has changed over time.
 *
 * Superseded entries are shown, not hidden. "They preferred email, now they
 * prefer phone" is the whole point — and an advisor explaining a decision made
 * last March needs to see what was true then, not only what is true now.
 */
export function MemoryTimeline({ entries, forKey, emptyMessage }: MemoryTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-card border-line/50 text-body-sm text-content-secondary border border-dashed p-6 text-center text-pretty">
        {emptyMessage ?? "Nothing recorded yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {forKey ? <p className="text-caption text-content-muted font-mono">{forKey}</p> : null}

      <ol className="flex flex-col gap-0">
        {entries.map((entry, index) => {
          const source = MEMORY_SOURCE_META[entry.source] ?? {
            label: entry.source,
            tone: "neutral" as const,
            hint: "",
          };
          const last = index === entries.length - 1;
          const current = entry.current !== false;

          return (
            <li key={entry.id} className="flex gap-3">
              <div aria-hidden="true" className="flex flex-col items-center">
                <span
                  className={cn(
                    "rounded-pill mt-1.5 h-2.5 w-2.5 shrink-0 border-2",
                    TONE_BORDER[source.tone].split(" ")[0],
                    current ? "" : "opacity-50"
                  )}
                />
                {!last ? <span className="bg-line/40 w-px flex-1" /> : null}
              </div>

              <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      "text-body-sm",
                      current ? "text-content font-medium" : "text-content-secondary"
                    )}
                  >
                    {typeof entry.value === "object"
                      ? JSON.stringify(entry.value)
                      : String(entry.value)}
                  </span>
                  {current ? (
                    <span className="rounded-pill border-success/40 text-success border px-1.5 text-[0.625rem] font-semibold">
                      Current
                    </span>
                  ) : null}
                </div>
                <p className="text-caption text-content-muted mt-0.5">
                  {source.label} · {timeAgo(entry.createdAt)}
                  {entry.sourceRef ? ` · ${entry.sourceRef}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
