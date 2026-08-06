"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type ClaimsPayload } from "@/lib/api";

/** Claims, as an operations view. Read-only — deciding a claim is an employee's job. */
export default function ClaimsPage() {
  const [data, setData] = useState<ClaimsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .claims()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Claims Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          The portfolio view. Claims are decided by the employees handling them, not from here.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Open"
              value={(data.byStatus.OPEN ?? 0) + (data.byStatus.IN_PROGRESS ?? 0)}
              icon="layers"
            />
            <Stat
              label="Awaiting approval"
              value={data.byStatus.AWAITING_APPROVAL ?? 0}
              tone="warning"
              icon="clock"
            />
            <Stat
              label="Resolved"
              value={data.byStatus.RESOLVED ?? 0}
              tone="success"
              icon="check"
            />
            <Stat
              label="Avg. processing"
              value={data.averageProcessingHours === null ? "—" : `${data.averageProcessingHours}h`}
              icon="chart"
            />
          </div>

          <div className="rounded-card border border-dashed border-line/50 bg-surface-raised/20 p-5">
            <p className="text-body-sm font-semibold text-content-secondary">
              Fraud indicators — not measured
            </p>
            <p className="mt-1 text-pretty text-caption text-content-muted">
              {data.fraudIndicators.reason}
            </p>
            <p className="mt-2 text-pretty text-caption text-content-muted">
              <span className="font-medium">Needs:</span> {data.fraudIndicators.needs}
            </p>
          </div>

          <Panel title="Recent claims">
            {data.recent.length === 0 ? (
              <Empty icon="scales">No claims have been raised yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Reference
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Claim
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Status
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Priority
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((c) => (
                      <tr key={c.id} className="border-b border-line/30 last:border-0">
                        <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                          {c.reference}
                        </td>
                        <td className="py-3 pr-4 text-body-sm text-content">{c.title}</td>
                        <td className="py-3 pr-4">
                          <Badge>{c.status}</Badge>
                        </td>
                        <td className="py-3">
                          <Badge tone={c.priority === "URGENT" ? "danger" : "neutral"}>
                            {c.priority}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : error ? null : (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
