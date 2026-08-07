"use client";

import { KnowledgeCard } from "./KnowledgeCard";
import type { KnowledgeArticle } from "../lib/types";

export interface KnowledgeListProps {
  articles: KnowledgeArticle[];
  loading?: boolean;
  error?: string | null;
  onOpen?: (article: KnowledgeArticle) => void;
  isBookmarked?: (id: string) => boolean;
  onToggleBookmark?: (id: string) => void;
  showGovernance?: boolean;
  emptyMessage?: string;
  /** Paging, when the caller is paging. */
  page?: number;
  pageCount?: number;
  total?: number;
  onPage?: (page: number) => void;
}

/**
 * A list of articles, with paging.
 *
 * Loading, error and empty are three different states and are drawn as three
 * different things. Collapsing them means a slow request looks like an empty
 * knowledge base, and people stop trusting the search.
 */
export function KnowledgeList({
  articles,
  loading,
  error,
  onOpen,
  isBookmarked,
  onToggleBookmark,
  showGovernance,
  emptyMessage,
  page = 0,
  pageCount = 1,
  total,
  onPage,
}: KnowledgeListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading knowledge</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card bg-surface-raised/40 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-control bg-danger/10 text-body-sm text-danger px-4 py-3">
        {error}
      </p>
    );
  }

  if (articles.length === 0) {
    return (
      <p className="rounded-card border-line/50 text-body-sm text-content-secondary border border-dashed p-6 text-center text-pretty">
        {emptyMessage ?? "No guidance matches that."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {articles.map((article) => (
          <li key={article.id}>
            <KnowledgeCard
              article={article}
              {...(onOpen ? { onOpen } : {})}
              bookmarked={isBookmarked?.(article.id) ?? false}
              {...(onToggleBookmark ? { onToggleBookmark } : {})}
              {...(showGovernance !== undefined ? { showGovernance } : {})}
            />
          </li>
        ))}
      </ul>

      {pageCount > 1 && onPage ? (
        <nav aria-label="Knowledge pages" className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page === 0}
            className="focus-ring rounded-control border-line/60 text-caption text-content border px-3 py-1.5 font-medium disabled:opacity-40"
          >
            Previous
          </button>
          {/* Announced politely so a page change is heard, not only seen. */}
          <p role="status" aria-live="polite" className="text-caption text-content-muted">
            Page {page + 1} of {pageCount}
            {total !== undefined ? ` · ${total} article${total === 1 ? "" : "s"}` : ""}
          </p>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount - 1}
            className="focus-ring rounded-control border-line/60 text-caption text-content border px-3 py-1.5 font-medium disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
