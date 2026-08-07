"use client";

import { KnowledgeSearchBar } from "./KnowledgeSearchBar";
import { timeAgo, type SearchHit, type SearchResult } from "../lib/types";

export interface SearchPanelProps {
  term: string;
  onTermChange: (term: string) => void;
  result: SearchResult | null;
  loading?: boolean;
  error?: string | null;
  onOpen?: (hit: SearchHit) => void;
  autoFocus?: boolean;
}

/**
 * Search, with its results.
 *
 * The result count is announced politely, so somebody using a screen reader
 * hears that a search returned three things without having to go looking. It is
 * polite rather than assertive because the search is debounced — an assertive
 * region would interrupt them on every keystroke.
 *
 * When nothing matches, the server's own explanation is shown. That message
 * says search matches words rather than meaning, which is the single most
 * useful thing a person can be told at that moment.
 */
export function SearchPanel({
  term,
  onTermChange,
  result,
  loading,
  error,
  onOpen,
  autoFocus,
}: SearchPanelProps) {
  const hits = result?.hits ?? [];
  const searched = term.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <KnowledgeSearchBar
        value={term}
        onChange={onTermChange}
        method={result?.method ?? "LEXICAL"}
        {...(autoFocus ? { autoFocus: true } : {})}
        {...(loading ? { busy: true } : {})}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? "Searching"
          : searched
            ? `${hits.length} result${hits.length === 1 ? "" : "s"}`
            : ""}
      </p>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 text-body-sm text-danger px-4 py-3">
          {error}
        </p>
      ) : null}

      {!searched ? (
        <p className="text-body-sm text-content-muted text-center text-pretty">
          Type to search guidance, circulars and procedures.
        </p>
      ) : loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card bg-surface-raised/40 h-16 animate-pulse" />
          ))}
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-card border-line/50 border border-dashed p-6 text-center">
          <p className="text-body-sm text-content-secondary text-pretty">
            {result?.note ?? "Nothing matched."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {hits.map((hit) => (
            <li key={hit.id}>
              <article className="rounded-card border-line/50 bg-surface-raised/30 border p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-body-sm text-content font-semibold text-pretty">
                    {onOpen ? (
                      <button
                        type="button"
                        onClick={() => onOpen(hit)}
                        className="focus-ring hover:text-brand rounded text-left"
                      >
                        {hit.title}
                      </button>
                    ) : (
                      hit.title
                    )}
                  </h3>
                  {/* The effective window is on the hit, so an expired circular
                      is visible in the result list rather than only after
                      opening it. */}
                  {hit.effectiveTo && new Date(hit.effectiveTo).getTime() <= Date.now() ? (
                    <span className="rounded-pill border-warning/40 text-warning border px-2 py-0.5 text-[0.625rem] font-semibold">
                      No longer in force
                    </span>
                  ) : null}
                </div>

                <p className="text-caption text-content-secondary mt-1 text-pretty">
                  {hit.excerpt ?? hit.summary}
                </p>

                <p className="text-caption text-content-muted mt-1.5">
                  matched {hit.matchedTerms.join(", ")}
                  {hit.sourceRef ? ` · ${hit.sourceRef}` : ""}
                  {hit.effectiveFrom ? ` · from ${timeAgo(hit.effectiveFrom)}` : ""}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
