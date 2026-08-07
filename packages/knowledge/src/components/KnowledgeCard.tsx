"use client";

import { cn } from "@aegis/utils";
import { BookmarkButton } from "./BookmarkButton";
import {
  CLASSIFICATION_META,
  STATUS_META,
  TONE_BORDER,
  TYPE_LABEL,
  effectiveState,
  tagsOf,
  timeAgo,
  type KnowledgeArticle,
} from "../lib/types";

export interface KnowledgeCardProps {
  article: KnowledgeArticle;
  onOpen?: (article: KnowledgeArticle) => void;
  bookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  /** Hide status and classification for a customer-facing surface. */
  showGovernance?: boolean;
  compact?: boolean;
}

/**
 * One article, as a card.
 *
 * Whether the guidance is *currently in force* is shown here rather than only
 * on the detail page. An advisor scanning a list needs to know a circular
 * expired last month before they quote it, not after — and a card that looks
 * identical whether or not it still applies invites exactly that mistake.
 *
 * The whole card is not a button. A card-sized click target swallows the
 * bookmark control and gives a screen reader one enormous unnamed link; the
 * title is the link, which is what a person reads anyway.
 */
export function KnowledgeCard({
  article,
  onOpen,
  bookmarked,
  onToggleBookmark,
  showGovernance = true,
  compact,
}: KnowledgeCardProps) {
  const status = STATUS_META[article.status];
  const classification = CLASSIFICATION_META[article.classification];
  const effective = effectiveState(article);
  const tags = tagsOf(article);

  return (
    <article
      className={cn(
        "rounded-card border-line/50 bg-surface-raised/30 border transition-colors",
        "hover:border-line/80",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-content-muted">
            {TYPE_LABEL[article.category] ?? article.category}
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            v{article.version}
          </p>

          <h3
            className={cn(
              "text-content mt-0.5 font-semibold text-pretty",
              compact ? "text-body-sm" : "text-body"
            )}
          >
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
          </h3>
        </div>

        {onToggleBookmark ? (
          <BookmarkButton
            id={article.id}
            title={article.title}
            bookmarked={Boolean(bookmarked)}
            onToggle={onToggleBookmark}
          />
        ) : null}
      </div>

      {!compact ? (
        <p className="text-body-sm text-content-secondary mt-2 line-clamp-2 text-pretty">
          {article.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {showGovernance ? (
          <>
            <span
              title={status.hint}
              className={cn(
                "rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold",
                TONE_BORDER[status.tone]
              )}
            >
              {status.label}
            </span>
            <span
              title={classification.hint}
              className={cn(
                "rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold",
                TONE_BORDER[classification.tone]
              )}
            >
              {classification.label}
            </span>
          </>
        ) : null}

        {effective.state !== "ALWAYS" ? (
          <span
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold",
              TONE_BORDER[effective.tone]
            )}
          >
            {effective.label}
          </span>
        ) : null}

        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-pill border-line/50 text-content-muted border px-2 py-0.5 text-[0.625rem]"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-caption text-content-muted mt-2.5">
        Updated {timeAgo(article.updatedAt)}
        {article.sourceRef ? (
          <>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span title="Where this guidance comes from">{article.sourceRef}</span>
          </>
        ) : null}
      </p>
    </article>
  );
}
