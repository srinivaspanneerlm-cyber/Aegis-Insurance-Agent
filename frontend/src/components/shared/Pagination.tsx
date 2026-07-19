"use client";

import type { PageInfo } from "@/types/domain";

interface PaginationProps {
  pagination: PageInfo;
  onPageChange: (page: number) => void;
  /** Disable both controls while a page fetch is in flight. */
  busy?: boolean;
}

/**
 * Prev / Next control for an offset-paginated list. Purely presentational: it
 * derives its state from the {@link PageInfo} envelope and delegates the actual
 * fetch to `onPageChange`. Renders nothing for a single-page list so a short
 * list looks exactly as it did before pagination was wired in.
 */
export function Pagination({ pagination, onPageChange, busy = false }: PaginationProps) {
  const { page, pages, total } = pagination;
  if (pages <= 1) return null;

  const atStart = page <= 1;
  const atEnd = page >= pages;
  const btn =
    "py-1.5 px-4 rounded-lg border border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-widest text-slate-300 " +
    "enabled:hover:border-cyan-500/40 enabled:hover:text-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:cursor-pointer";

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={atStart || busy}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        <button
          type="button"
          className={btn}
          disabled={atEnd || busy}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
