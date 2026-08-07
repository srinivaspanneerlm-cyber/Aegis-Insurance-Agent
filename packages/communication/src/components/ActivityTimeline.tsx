"use client";

import { cn } from "@aegis/utils";
import { SOURCE_META, TONE_DOT, timeAgo, type TimelineEntry } from "../lib/types";

export interface ActivityTimelineProps {
  entries: TimelineEntry[];
  /** How many entries each subsystem contributed, so silence can be explained. */
  sources?: Record<string, number>;
  emptyMessage?: string;
}

/**
 * What has happened, newest first.
 *
 * An ordered list rather than a decorated stack of divs — a timeline is a
 * sequence, and a screen reader announcing "item 3 of 40" is giving somebody
 * the same orientation the connecting line gives a sighted reader.
 *
 * When there is nothing, it says which subsystems were checked. An empty feed
 * that does not distinguish "nothing has happened" from "we failed to load"
 * teaches people to distrust it.
 */
export function ActivityTimeline({ entries, sources, emptyMessage }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-card border-line/50 border border-dashed p-6 text-center">
        <p className="text-body-sm text-content-secondary text-pretty">
          {emptyMessage ?? "Nothing has happened yet."}
        </p>
        {sources ? (
          <p className="text-caption text-content-muted mt-2">
            Checked {Object.keys(sources).join(", ")}.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-0">
      {entries.map((entry, index) => {
        const meta = SOURCE_META[entry.source] ?? { label: entry.source, tone: "neutral" as const };
        const last = index === entries.length - 1;

        return (
          // Source, kind, subject and timestamp together identify an entry:
          // no subsystem emits the same kind of event for the same subject at
          // the same instant.
          <li
            key={`${entry.source}-${entry.kind}-${entry.subjectId}-${entry.at}`}
            className="flex gap-3"
          >
            {/* The rail: a dot per event and a line joining them, hidden from
                assistive technology because the list already conveys order. */}
            <div aria-hidden="true" className="flex flex-col items-center">
              <span
                className={cn("rounded-pill mt-1.5 h-2.5 w-2.5 shrink-0", TONE_DOT[meta.tone])}
              />
              {!last ? <span className="bg-line/40 w-px flex-1" /> : null}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-caption text-content-muted font-medium tracking-wide uppercase">
                  {meta.label}
                </span>
                <time dateTime={entry.at} className="text-caption text-content-muted">
                  {timeAgo(entry.at)}
                </time>
                {entry.actorKind === "AI" ? (
                  // Labelled, always. Somebody reading their own history is
                  // entitled to know which entries a machine wrote.
                  <span className="rounded-pill border-success/40 text-success border px-1.5 text-[0.625rem] font-semibold">
                    Aegis
                  </span>
                ) : null}
              </div>

              <p className="text-body-sm text-content mt-0.5 text-pretty">{entry.summary}</p>

              {entry.deepLink ? (
                <a
                  href={entry.deepLink}
                  className="focus-ring rounded-control text-caption text-brand mt-1 inline-block font-medium"
                >
                  Open
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
