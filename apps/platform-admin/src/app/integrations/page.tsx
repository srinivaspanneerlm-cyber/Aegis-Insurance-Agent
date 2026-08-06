"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { platformApi, type Integration } from "@/lib/api";

/** External services, and what breaks when one is not wired. */
export default function IntegrationsPage() {
  const [rows, setRows] = useState<Integration[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .integrations()
      .then((d) => {
        if (!cancelled) setRows(d.integrations);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Integrations</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          What is wired, and what stops working when something is not.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {rows === null && !error ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : null}

      {rows ? (
        <Panel title={`${rows.filter((r) => r.configured).length} of ${rows.length} configured`}>
          <ul className="flex flex-col gap-4">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-line/30 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-body-sm font-medium text-content">{r.name}</p>
                  <Badge tone={r.configured ? "success" : r.envKey ? "warning" : "neutral"}>
                    {r.configured ? "Configured" : r.envKey ? "Not configured" : "Not implemented"}
                  </Badge>
                  {r.envKey ? (
                    <code className="text-caption text-content-muted">{r.envKey}</code>
                  ) : null}
                </div>
                <p className="mt-1 text-pretty text-caption text-content-secondary">{r.purpose}</p>
                <p className="mt-1 text-pretty text-caption text-content-muted">{r.impact}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
