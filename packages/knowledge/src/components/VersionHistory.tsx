"use client";

import { cn } from "@aegis/utils";
import { TONE_BORDER, timeAgo, type KnowledgeHistory } from "../lib/types";

export interface VersionHistoryProps {
  history: KnowledgeHistory;
  onViewVersion?: (version: number) => void;
}

const DECISION_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  APPROVED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  SCHEDULED_REVIEW: "neutral",
};

/**
 * What this guidance said before, and who decided.
 *
 * Versions and reviews are shown as one interleaved history rather than two
 * lists. They are the same story — somebody wrote, somebody judged — and
 * splitting them makes a reader reconstruct the order by comparing timestamps
 * across two columns.
 *
 * An ordered list, so a screen reader announces position. That is what tells
 * somebody they are reading the third of nine revisions.
 */
export function VersionHistory({ history, onViewVersion }: VersionHistoryProps) {
  const entries = [
    ...history.versions.map((v) => ({
      at: v.createdAt,
      kind: "version" as const,
      version: v.version,
      title: v.title,
      note: v.changeNote,
      actor: v.authoredById,
    })),
    ...history.reviews.map((r) => ({
      at: r.createdAt,
      kind: "review" as const,
      decision: r.decision,
      note: r.notes,
      actor: r.reviewerId,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (entries.length === 0) {
    return (
      <p className="rounded-card border-line/50 text-body-sm text-content-secondary border border-dashed p-6 text-center text-pretty">
        This is the first version. Nothing has changed since it was written.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-0">
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        const tone =
          entry.kind === "review" ? (DECISION_TONE[entry.decision] ?? "neutral") : "info";

        return (
          // Kind, timestamp and the version or decision identify an entry: no
          // two versions share a number, and no two reviews land on the same
          // instant with the same decision.
          <li
            key={`${entry.kind}-${entry.at}-${entry.kind === "version" ? entry.version : entry.decision}`}
            className="flex gap-3"
          >
            <div aria-hidden="true" className="flex flex-col items-center">
              <span
                className={cn(
                  "rounded-pill mt-1.5 h-2.5 w-2.5 shrink-0 border-2",
                  TONE_BORDER[tone].split(" ")[0]
                )}
              />
              {!last ? <span className="bg-line/40 w-px flex-1" /> : null}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  className={cn(
                    "rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold",
                    TONE_BORDER[tone]
                  )}
                >
                  {entry.kind === "version"
                    ? `Version ${entry.version}`
                    : entry.decision.replace(/_/g, " ")}
                </span>
                <time dateTime={entry.at} className="text-caption text-content-muted">
                  {timeAgo(entry.at)}
                </time>
              </div>

              {entry.kind === "version" ? (
                <p className="text-body-sm text-content mt-1 text-pretty">{entry.title}</p>
              ) : null}

              {entry.note ? (
                <p className="text-caption text-content-secondary mt-0.5 text-pretty">
                  {entry.note}
                </p>
              ) : entry.kind === "version" ? (
                // Naming the gap rather than leaving a blank line: an author who
                // sees "no reason recorded" learns to record one.
                <p className="text-caption text-content-muted mt-0.5 italic">No reason recorded.</p>
              ) : null}

              {entry.kind === "version" && onViewVersion ? (
                <button
                  type="button"
                  onClick={() => onViewVersion(entry.version)}
                  className="focus-ring rounded-control text-caption text-brand mt-1 font-medium"
                >
                  See what it said
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
