"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { workspaceApi } from "@/lib/api";
import type { KnowledgeArticle } from "@/lib/workspace";

const CATEGORIES = [
  "POLICY",
  "SOP",
  "CIRCULAR",
  "GUIDELINE",
  "FAQ",
  "TRAINING",
  "PRODUCT",
] as const;

/**
 * The knowledge centre.
 *
 * The search box in the workspace header posts here with `?q=`, so a query
 * typed anywhere lands on this page already run. Reading that parameter on
 * mount rather than requiring a second submit is the difference between a
 * search box and something that merely looks like one.
 */
export default function KnowledgePage() {
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string>("");
  const [articles, setArticles] = useState<KnowledgeArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (q: string, cat: string) => {
    setArticles(null);
    setError(null);
    try {
      const data = await workspaceApi.knowledge(q, cat || undefined);
      setArticles(data.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setArticles([]);
    }
  }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    setTerm(initial);
    void run(initial, "");
  }, [run]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Knowledge Center</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Policies, standard operating procedures, circulars, guidelines and product notes.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(term, category);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <label htmlFor="kb-search" className="sr-only">
            Search the knowledge centre
          </label>
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            id="kb-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Claim intake, waiting period, KYC documents…"
            className="h-11 w-full rounded-control border border-line/60 bg-surface-raised/40 pl-9 pr-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>

        <label htmlFor="kb-category" className="sr-only">
          Category
        </label>
        <select
          id="kb-category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            void run(term, event.target.value);
          }}
          className="h-11 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 sm:w-48"
        >
          <option value="">Every category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="focus-ring h-11 rounded-control bg-brand px-5 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
        >
          Search
        </button>
      </form>

      <Panel
        title={
          articles ? `${articles.length} result${articles.length === 1 ? "" : "s"}` : "Searching"
        }
      >
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : articles === null ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <Empty icon="book">
            Nothing matched that. Try a shorter phrase, or clear the category filter.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-5">
            {articles.map((article) => (
              <li key={article.id} className="border-b border-line/30 pb-5 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{article.category}</Badge>
                  <h2 className="text-body font-semibold text-content">{article.title}</h2>
                </div>
                <p className="mt-2 text-pretty text-body-sm text-content-secondary">
                  {article.summary}
                </p>
                {article.tags ? (
                  <p className="mt-2 text-caption text-content-muted">{article.tags}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
