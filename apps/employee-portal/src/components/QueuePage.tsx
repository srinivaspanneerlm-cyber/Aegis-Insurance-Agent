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
}: {
  title: string;
  description: string;
  /** Null shows everything assigned to them. */
  kinds: readonly string[] | null;
  emptyMessage: string;
}) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .queue()
      .then((data) => {
        if (cancelled) return;
        setItems(kinds ? data.items.filter((item) => kinds.includes(item.kind)) : data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this queue.");
      });
    return () => {
      cancelled = true;
    };
  }, [kinds]);

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
      </Panel>
    </div>
  );
}
