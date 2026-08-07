"use client";

import { cn } from "@aegis/utils";
import { STATUS_META, TONE_BORDER, timeAgo, type KnowledgeArticle } from "../lib/types";

export interface KnowledgeTimelineProps {
  articles: KnowledgeArticle[];
  onOpen?: (article: KnowledgeArticle) => void;
  emptyMessage?: string;
}

/**
 * Recent activity across the knowledge base.
 *
 * Grouped by day, because "what changed this week" is the question a knowledge
 * manager actually asks, and a flat list of timestamps makes them do the
 * grouping in their head.
 */
export function KnowledgeTimeline({ articles, onOpen, emptyMessage }: KnowledgeTimelineProps) {
  if (articles.length === 0) {
    return (
      <p className="rounded-card border-line/50 text-body-sm text-content-secondary border border-dashed p-6 text-center text-pretty">
        {emptyMessage ?? "Nothing has changed recently."}
      </p>
    );
  }

  const groups = new Map<string, KnowledgeArticle[]>();
  for (const article of [...articles].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )) {
    const day = new Date(article.updatedAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    groups.set(day, [...(groups.get(day) ?? []), article]);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h3 className="text-caption text-content-muted mb-2 font-semibold tracking-wide uppercase">
            {day}
          </h3>
          <ol className="flex flex-col gap-2">
            {items.map((article) => {
              const status = STATUS_META[article.status];
              return (
                <li key={article.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "rounded-pill mt-1.5 h-2 w-2 shrink-0 border-2",
                      TONE_BORDER[status.tone].split(" ")[0]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-content text-pretty">
                      {onOpen ? (
                        <button
                          type="button"
                          onClick={() => onOpen(article)}
                          className="focus-ring hover:text-brand rounded text-left"
                        >
                          {article.title}
                        </button>
                      ) : (
                        article.title
                      )}
                    </p>
                    <p className="text-caption text-content-muted">
                      {status.label} · v{article.version} · {timeAgo(article.updatedAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
