"use client";

import { useEffect, useState } from "react";
import { Empty, Panel, Skeleton } from "@/components/Cards";
import { QueueTable } from "@/components/QueueTable";
import { workspaceApi } from "@/lib/api";
import type { WorkItem } from "@/lib/workspace";

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
}) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // How many the server returned before this page filtered by kind. The
  // endpoint caps at 100 across every kind, so a busy advisor's claims can sit
  // past the cut and never appear here. Tracking the raw count lets the page
  // say so rather than quietly showing a short list.
  const [fetched, setFetched] = useState(0);

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">{title}</h1>
        <p className="mt-1 text-body-sm text-content-secondary">{description}</p>
      </header>

      <Panel title={items ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Loading"}>
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : items === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty>{emptyMessage}</Empty>
        ) : (
          <QueueTable items={items} />
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
