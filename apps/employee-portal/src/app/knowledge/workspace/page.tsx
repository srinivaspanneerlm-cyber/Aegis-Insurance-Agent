"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KnowledgeFilters,
  KnowledgeList,
  KnowledgeTimeline,
  SearchPanel,
  emptyFilters,
  useArticles,
  useBookmarks,
  useCategories,
  useKnowledgeSearch,
  useTags,
  type ArticleFilters,
  type KnowledgeArticle,
} from "@aegis/knowledge";
import { Empty, Panel, Stat } from "@/components/Cards";
import { knowledgeClient } from "@/lib/knowledgeClient";

/**
 * The knowledge workspace.
 *
 * Search first, because that is what somebody came here to do — a dashboard
 * that leads with statistics makes an advisor scroll past them to find the box
 * they wanted.
 *
 * Everything below is one library viewed three ways: what changed recently,
 * what you saved, and everything filtered. They read the same articles from the
 * same fetch rather than three requests for overlapping data.
 */
export default function KnowledgeWorkspacePage() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [filters, setFilters] = useState<ArticleFilters>(emptyFilters);

  const categories = useCategories(knowledgeClient);
  const tags = useTags(knowledgeClient);
  const articles = useArticles(knowledgeClient, filters);
  const search = useKnowledgeSearch(knowledgeClient, term, { includeUnapproved: true });
  const bookmarks = useBookmarks();

  const open = (article: KnowledgeArticle | { slug: string }) =>
    router.push(`/knowledge/a/${article.slug}`);

  // Memoised, not inlined. `articles.data ?? []` builds a new array on every
  // render, which changes the identity the three memos below depend on — they
  // would recompute every render and the memo would be decorative.
  const all = useMemo(() => articles.data ?? [], [articles.data]);

  const recent = useMemo(
    () =>
      [...all]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [all]
  );
  const popular = useMemo(
    () => [...all].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
    [all]
  );
  const saved = useMemo(
    () => all.filter((a) => bookmarks.ids.includes(a.id)),
    [all, bookmarks.ids]
  );
  const awaitingReview = all.filter((a) => a.status === "IN_REVIEW").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Knowledge</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Guidance, circulars and procedures — with who approved each one.
        </p>
      </header>

      <Panel title="Find something">
        <SearchPanel
          term={term}
          onTermChange={setTerm}
          result={search.data}
          loading={search.loading}
          error={search.error}
          onOpen={(hit) => open(hit)}
        />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Articles" value={all.length} icon="book" />
        <Stat
          label="Awaiting review"
          value={awaitingReview}
          icon="clock"
          tone={awaitingReview > 0 ? "warning" : "neutral"}
        />
        <Stat label="Saved" value={saved.length} icon="check" />
        <Stat label="Categories" value={categories.data?.length ?? 0} icon="layers" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Panel title="The library">
            <div className="mb-4">
              <KnowledgeFilters
                values={filters}
                onChange={setFilters}
                tags={tags.data ?? []}
                categories={categories.data ?? []}
                serverFiltered={articles.serverFiltered}
              />
            </div>

            <KnowledgeList
              articles={articles.items}
              loading={articles.loading}
              error={articles.error}
              onOpen={open}
              isBookmarked={bookmarks.has}
              onToggleBookmark={bookmarks.toggle}
              page={articles.page}
              pageCount={articles.pageCount}
              total={articles.total}
              onPage={articles.setPage}
              emptyMessage="Nothing matches those filters."
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Saved on this device">
            {saved.length === 0 ? (
              <Empty icon="book">
                Nothing saved yet. Bookmarks stay in this browser — they do not follow you to
                another device.
              </Empty>
            ) : (
              <KnowledgeList
                articles={saved}
                onOpen={open}
                isBookmarked={bookmarks.has}
                onToggleBookmark={bookmarks.toggle}
              />
            )}
          </Panel>

          <Panel title="Most read">
            {popular.length === 0 ? (
              <Empty icon="chart">Nothing has been opened yet.</Empty>
            ) : (
              <ol className="flex flex-col gap-2">
                {popular.map((article) => (
                  <li key={article.id} className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => open(article)}
                      className="focus-ring text-pretty rounded text-left text-body-sm text-content hover:text-brand"
                    >
                      {article.title}
                    </button>
                    <span className="shrink-0 text-caption text-content-muted">
                      {article.viewCount}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Recently changed">
            <KnowledgeTimeline articles={recent} onOpen={open} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
