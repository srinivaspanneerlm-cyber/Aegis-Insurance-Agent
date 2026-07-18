import { PAGINATION } from "../config/constants";

export interface PageParams {
  page: number;
  limit: number;
}

/**
 * Parse and bound `?page` / `?limit` from a request query.
 *
 * `limit` defaults to the maximum page size and is hard-capped there, so a list
 * endpoint can no longer run an unbounded scan (CLAUDE.md §9). Defaulting to the
 * cap (rather than a small page) keeps existing callers backward-compatible:
 * a client that passes neither param still receives the whole list, up to the
 * cap, exactly as before.
 */
export function parsePageParams(query: { page?: unknown; limit?: unknown } = {}): PageParams {
  const first = (v: unknown): string => (Array.isArray(v) ? String(v[0]) : String(v));
  const toInt = (v: unknown, fallback: number): number => {
    const n = parseInt(first(v), 10);
    return Number.isNaN(n) ? fallback : n;
  };
  const page = Math.max(toInt(query.page, 1), 1);
  const limit = Math.min(
    Math.max(toInt(query.limit, PAGINATION.MAX_LIMIT), 1),
    PAGINATION.MAX_LIMIT
  );
  return { page, limit };
}
