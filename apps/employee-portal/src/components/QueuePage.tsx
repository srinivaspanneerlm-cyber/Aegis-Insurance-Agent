"use client";

import { useEffect, useMemo, useState } from "react";
import { Empty, Panel, Skeleton } from "@/components/Cards";
import { QueueTable } from "@/components/QueueTable";
import { workspaceApi } from "@/lib/api";
import { KIND_LABELS, STATUS_LABELS, isOverdue, type WorkItem } from "@/lib/workspace";

/**
 * A filtered view of the same queue.
 *
 * Claims, KYC, renewals and complaints are one table with a `kind` on the
 * server, so they are one component with a filter here. Four page components
 * differing by a string is four places for the empty state, the loading state
 * and the error state to drift.
 */
export function QueuePage({
  title,
  description,
  kinds,
  emptyMessage,
  reloadToken = 0,
  filterable = false,
}: {
  title: string;
  description: string;
  /** Null shows everything assigned to them. */
  kinds: readonly string[] | null;
  emptyMessage: string;
  /**
   * Bumped by a parent that has just changed the queue, to re-read it.
   *
   * A number rather than a callback: the queue is the server's answer, and a
   * parent that could splice a row in locally would be showing its own guess at
   * where routing put it.
   */
  reloadToken?: number;
  /**
   * Show the status/kind/overdue filters.
   *
   * Off by default. A screen already narrowed to one kind gains little from a
   * kind filter, and the filters live here rather than in a wrapper so there is
   * one implementation of "which of these rows am I looking at" rather than one
   * per queue screen.
   */
  filterable?: boolean;
}) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // How many the server returned before this page filtered by kind. The
  // endpoint caps at 100 across every kind, so a busy advisor's claims can sit
  // past the cut and never appear here. Tracking the raw count lets the page
  // say so rather than quietly showing a short list.
  const [fetched, setFetched] = useState(0);

  const [status, setStatus] = useState("ALL");
  const [kind, setKind] = useState("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .queue()
      .then((data) => {
        if (cancelled) return;
        setFetched(data.items.length);
        setItems(kinds ? data.items.filter((item) => kinds.includes(item.kind)) : data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this queue.");
      });
    return () => {
      cancelled = true;
    };
  }, [kinds, reloadToken]);

  // Derived from what came back, not from a fixed list: offering a filter for a
  // status nobody in this queue has is a control that can only ever empty it.
  const presentStatuses = useMemo(
    () => [...new Set((items ?? []).map((item) => item.status))].sort(),
    [items]
  );
  const presentKinds = useMemo(
    () => [...new Set((items ?? []).map((item) => item.kind))].sort(),
    [items]
  );

  const shown = useMemo(() => {
    if (!items) return null;
    return items.filter(
      (item) =>
        (status === "ALL" || item.status === status) &&
        (kind === "ALL" || item.kind === kind) &&
        (!overdueOnly || isOverdue(item))
    );
  }, [items, kind, overdueOnly, status]);

  const overdueCount = (items ?? []).filter(isOverdue).length;
  const filtered = shown !== null && items !== null && shown.length !== items.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">{title}</h1>
        <p className="mt-1 text-body-sm text-content-secondary">{description}</p>
      </header>

      {filterable && items && items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-caption text-content-secondary">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="focus-ring rounded-control border border-line/50 bg-surface px-2 py-1 text-caption text-content"
            >
              <option value="ALL">All</option>
              {presentStatuses.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-caption text-content-secondary">Kind</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="focus-ring rounded-control border border-line/50 bg-surface px-2 py-1 text-caption text-content"
            >
              <option value="ALL">All</option>
              {presentKinds.map((value) => (
                <option key={value} value={value}>
                  {KIND_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
              className="focus-ring rounded border-line/50"
            />
            <span className="text-caption text-content-secondary">
              Overdue only{overdueCount > 0 ? ` (${overdueCount})` : ""}
            </span>
          </label>

          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setStatus("ALL");
                setKind("ALL");
                setOverdueOnly(false);
              }}
              className="focus-ring rounded text-caption text-brand"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      <Panel title={shown ? `${shown.length} item${shown.length === 1 ? "" : "s"}` : "Loading"}>
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : shown === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          // Two different empties. "Nothing matches your filters" and "you have
          // nothing" look identical on screen and mean opposite things.
          <Empty>{filtered ? "Nothing matches these filters." : emptyMessage}</Empty>
        ) : (
          <QueueTable items={shown} />
        )}

        {/* The endpoint returns at most 100 items across every kind, then this
            page filters by kind. At the cap, work of this kind can sit past the
            cut and never appear — so the page says so rather than presenting a
            truncated list as the whole queue. */}
        {fetched >= 100 ? (
          <p role="status" className="mt-4 text-pretty text-caption text-content-muted">
            Showing the 100 most urgent items across all your work. If you have more than that, some
            of this kind may not be listed.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
