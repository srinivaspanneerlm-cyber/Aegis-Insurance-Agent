"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { platformApi } from "@/lib/api";
import { STATUS_TONE, formatBytes, formatUptime, type Overview } from "@/lib/platform";

/**
 * Infrastructure.
 *
 * Re-probes on demand rather than polling. A console that polls every few
 * seconds adds load to the very dependencies an operator is worried about, and
 * during an incident that is exactly the wrong contribution.
 */
export default function InfrastructurePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.overview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Empty icon="close">{error}</Empty>;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );

  const { host, process: proc } = data.resources;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-content">Infrastructure</h1>
          <p className="mt-1 text-body-sm text-content-secondary">
            Probed when you open this page, not polled.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setData(null);
            void load();
          }}
          className="focus-ring rounded-control border border-line px-4 py-2 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
        >
          Re-probe
        </button>
      </header>

      <Panel title="Components">
        <ul className="flex flex-col gap-3">
          {data.components.map((c) => (
            <li key={c.id} className="border-b border-line/30 pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-body-sm font-medium text-content">{c.name}</p>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status.replace("_", " ")}</Badge>
                  <Badge>{c.implementation}</Badge>
                </div>
                {c.latencyMs !== null ? (
                  <span className="text-caption tabular-nums text-content-muted">
                    {c.latencyMs}ms
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-pretty text-caption text-content-secondary">{c.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Host memory used"
          value={`${host.usedMemoryPercent}%`}
          hint={`${formatBytes(host.freeMemoryBytes)} free`}
          icon="layers"
        />
        <Stat
          label="Process heap"
          value={formatBytes(proc.heapUsedBytes)}
          hint={`of ${formatBytes(proc.heapTotalBytes)}`}
          icon="chart"
        />
        <Stat label="Resident memory" value={formatBytes(proc.rssBytes)} icon="bolt" />
        <Stat
          label="Process uptime"
          value={formatUptime(proc.uptimeSeconds)}
          hint={`host up ${formatUptime(host.uptimeSeconds)}`}
          icon="clock"
        />
      </div>

      <Panel title="Load">
        {host.loadAverageMeaningful ? (
          <dl className="grid grid-cols-3 gap-4">
            {[
              ["1 min", host.loadAverage.one],
              ["5 min", host.loadAverage.five],
              ["15 min", host.loadAverage.fifteen],
            ].map(([l, v]) => (
              <div key={l as string}>
                <dt className="text-caption uppercase text-content-muted">{l as string}</dt>
                <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                  {(v as number).toFixed(2)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <Empty>Load average is not meaningful on {host.platform}.</Empty>
        )}
        <p className="mt-3 text-pretty text-caption text-content-muted">
          {host.cores} core(s). Load per core is the comparable figure —
          {host.loadPerCore !== null ? ` currently ${host.loadPerCore}.` : " unavailable here."}
        </p>
      </Panel>
    </div>
  );
}
