"use client";

/**
 * State management for the knowledge workspace.
 *
 * Plain hooks over the client, rather than a store library. The state here is
 * per-screen and short-lived — a search, a filter set, a page of results — and
 * a global store would make four screens share state that has no reason to be
 * shared. The one genuinely global thing is bookmarks, and that has its own
 * hook backed by storage.
 *
 * Every async hook reports the same three things: `loading`, `error`, `data`.
 * A screen that cannot tell "still fetching" from "returned nothing" shows an
 * empty state during a slow request, and people conclude the platform is empty.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KnowledgeClient, KnowledgeError } from "../lib/client";
import type {
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeHistory,
  KnowledgeTag,
  MemoryFact,
  MemoryScope,
  SearchResult,
} from "../lib/types";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** The machine-readable code, so a caller can distinguish 403 from 404. */
  code: string | null;
}

const idle = <T>(): AsyncState<T> => ({ data: null, loading: true, error: null, code: null });

/**
 * Runs an async function and tracks its state.
 *
 * The `settled` ref is what stops a slow first request from overwriting a fast
 * second one — the classic search race where typing "motor" then "health"
 * leaves you looking at motor results under a health query.
 */
function useAsync<T>(
  run: () => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {}
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>(idle<T>());
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null, code: null });
      return;
    }

    const ticket = ++latest.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    run()
      .then((data) => {
        if (ticket !== latest.current) return;
        setState({ data, loading: false, error: null, code: null });
      })
      .catch((err: unknown) => {
        if (ticket !== latest.current) return;
        const known = err instanceof KnowledgeError;
        setState({
          data: null,
          loading: false,
          error: known ? err.message : "Something went wrong.",
          code: known ? err.code : "ERROR",
        });
      });
    // `run` is intentionally excluded: callers build it inline, so including it
    // would re-fetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

// ── Knowledge ────────────────────────────────────────────────────────────────

export function useCategories(client: KnowledgeClient) {
  return useAsync<KnowledgeCategory[]>(
    () => client.categories().then((r) => r.categories),
    [client]
  );
}

export function useTags(client: KnowledgeClient) {
  return useAsync<KnowledgeTag[]>(() => client.tags().then((r) => r.tags), [client]);
}

export interface ArticleFilters {
  category: string;
  status: string;
  tag: string;
  classification: string;
  /** ISO date; articles updated on or after it. */
  updatedSince: string;
}

export const emptyFilters: ArticleFilters = {
  category: "",
  status: "",
  tag: "",
  classification: "",
  updatedSince: "",
};

/**
 * The article list, with filtering and paging.
 *
 * Category and status are sent to the server, which indexes them. Tag,
 * classification and date are applied here, because the Phase A list endpoint
 * does not accept them and Phase B may not change the backend. That is a real
 * limitation with a real consequence — filtering client-side only narrows the
 * page already fetched — so `serverFiltered` is reported and the UI says so.
 */
export function useArticles(client: KnowledgeClient, filters: ArticleFilters, pageSize = 12) {
  const [page, setPage] = useState(0);

  const query = useAsync<KnowledgeArticle[]>(
    () =>
      client
        .articles({
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          take: 100,
        })
        .then((r) => r.articles),
    [client, filters.category, filters.status]
  );

  // Reset to the first page whenever the result set changes underneath.
  useEffect(() => {
    setPage(0);
  }, [filters.category, filters.status, filters.tag, filters.classification, filters.updatedSince]);

  const filtered = useMemo(() => {
    const all = query.data ?? [];
    const since = filters.updatedSince ? new Date(filters.updatedSince).getTime() : null;

    return all.filter((article) => {
      if (filters.classification && article.classification !== filters.classification) return false;
      if (filters.tag) {
        const tags = (article.tags ?? "").toLowerCase();
        if (
          !tags
            .split(",")
            .map((t) => t.trim())
            .includes(filters.tag.toLowerCase())
        )
          return false;
      }
      if (since !== null && new Date(article.updatedAt).getTime() < since) return false;
      return true;
    });
  }, [query.data, filters.classification, filters.tag, filters.updatedSince]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const items = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return {
    ...query,
    items,
    total: filtered.length,
    page: current,
    pageCount,
    setPage,
    next: () => setPage((p) => Math.min(p + 1, pageCount - 1)),
    previous: () => setPage((p) => Math.max(p - 1, 0)),
    /** Which filters the server applied. The rest narrowed only what was fetched. */
    serverFiltered: ["category", "status"] as const,
  };
}

/**
 * Search, debounced.
 *
 * 300 ms: long enough that a normal typist issues one request per word rather
 * than one per keystroke, short enough that it does not feel like waiting.
 */
export function useKnowledgeSearch(
  client: KnowledgeClient,
  term: string,
  options: { category?: string; includeUnapproved?: boolean; debounceMs?: number } = {}
) {
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), options.debounceMs ?? 300);
    return () => clearTimeout(timer);
  }, [term, options.debounceMs]);

  const trimmed = debounced.trim();

  return useAsync<SearchResult>(
    () =>
      client.search({
        q: trimmed,
        ...(options.category ? { category: options.category } : {}),
        ...(options.includeUnapproved ? { includeUnapproved: true } : {}),
      }),
    [client, trimmed, options.category, options.includeUnapproved],
    // An empty box is not a search. Firing one returns a "no searchable words"
    // note that reads as a failure the moment the page loads.
    { enabled: trimmed.length > 0 }
  );
}

export function useArticle(client: KnowledgeClient, idOrSlug: string | null) {
  return useAsync<KnowledgeArticle>(() => client.article(idOrSlug ?? ""), [client, idOrSlug], {
    enabled: Boolean(idOrSlug),
  });
}

export function useHistory(client: KnowledgeClient, id: string | null) {
  return useAsync<KnowledgeHistory>(() => client.history(id ?? ""), [client, id], {
    enabled: Boolean(id),
  });
}

export function useAnalytics(client: KnowledgeClient, enabled = true) {
  return useAsync<Record<string, unknown>>(() => client.analytics(), [client], { enabled });
}

// ── Memory ───────────────────────────────────────────────────────────────────

export function useMemory(
  client: KnowledgeClient,
  scope: MemoryScope,
  subjectId: string | null,
  options: { kind?: string; prefix?: string } = {}
) {
  return useAsync<MemoryFact[]>(
    () => client.memory(scope, subjectId ?? "", options).then((r) => r.facts),
    [client, scope, subjectId, options.kind, options.prefix],
    { enabled: Boolean(subjectId) }
  );
}

export function useMemoryHistory(
  client: KnowledgeClient,
  scope: MemoryScope,
  subjectId: string | null,
  key: string | null
) {
  return useAsync<MemoryFact[]>(
    () => client.memoryHistory(scope, subjectId ?? "", key ?? "").then((r) => r.entries),
    [client, scope, subjectId, key],
    { enabled: Boolean(subjectId && key) }
  );
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

const BOOKMARK_KEY = "aegis.knowledge.bookmarks";

/**
 * Bookmarks, stored in the browser.
 *
 * Phase A has no bookmark endpoint and Phase B may not add one, so these live
 * in `localStorage` and do not follow somebody to another device. That is a
 * real limitation rather than a hidden one: `persistence` is returned so the UI
 * can say "saved on this device", instead of implying a sync that does not
 * happen.
 *
 * Reading is deferred to an effect because `localStorage` does not exist during
 * a server render, and touching it there fails the whole page rather than one
 * button.
 */
export function useBookmarks() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BOOKMARK_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setIds(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
    } catch {
      // Private browsing, a full quota, or a corrupted value. Bookmarks are a
      // convenience; losing them must not take the page with it.
      setIds([]);
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: string[]) => {
    setIds(next);
    try {
      window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
    } catch {
      /* see above */
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      persist(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
    },
    [ids, persist]
  );

  return {
    ids,
    ready,
    has: useCallback((id: string) => ids.includes(id), [ids]),
    toggle,
    clear: useCallback(() => persist([]), [persist]),
    persistence: "device" as const,
  };
}

export { KnowledgeClient, KnowledgeError };
