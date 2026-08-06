"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { platformApi } from "@/lib/api";
import { formatBytes, formatUptime, type Overview } from "@/lib/platform";

/**
 * System monitoring.
 *
 * Point-in-time readings, refreshed when asked. The page is explicit that these
 * are readings rather than a trend, because a number without a history invites
 * the reader to imagine one — and imagining a trend from a single sample is how
 * an operator concludes the wrong thing during an incident.
 */
export default function MonitoringPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [takenAt, setTakenAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.overview());
      setTakenAt(new Date());
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
          <h1 className="text-h1 font-bold tracking-tight text-content">System Monitoring</h1>
          <p className="mt-1 text-body-sm text-content-secondary">
            Read {takenAt ? takenAt.toLocaleTimeString() : "now"}. These are single readings, not
            trends.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="focus-ring rounded-control border border-line px-4 py-2 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
        >
          Refresh
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Host memory"
          value={`${host.usedMemoryPercent}%`}
          hint={`${formatBytes(host.freeMemoryBytes)} free`}
          tone={
            host.usedMemoryPercent > 90
              ? "danger"
              : host.usedMemoryPercent > 75
                ? "warning"
                : "neutral"
          }
          icon="layers"
        />
        <Stat
          label="Load per core"
          value={host.loadAverageMeaningful ? (host.loadPerCore ?? "—") : "n/a"}
          hint={`${host.cores} core(s)`}
          icon="bolt"
        />
        <Stat
          label="Process heap"
          value={formatBytes(proc.heapUsedBytes)}
          hint={`of ${formatBytes(proc.heapTotalBytes)}`}
          icon="chart"
        />
        <Stat
          label="Uptime"
          value={formatUptime(proc.uptimeSeconds)}
          hint={`pid ${proc.pid}`}
          icon="clock"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Live users"
          value={data.identity.customers + data.identity.employees}
          icon="users"
          hint="accounts on the platform"
        />
        <Stat
          label="Failed sign-ins today"
          value={data.security.failedLoginsToday}
          icon="lock"
          tone={data.security.failedLoginsToday > 20 ? "warning" : "neutral"}
        />
        <Stat label="Denials today" value={data.security.permissionDenialsToday} icon="shield" />
        <Stat
          label="AI systems idle"
          value={data.ai.filter((a) => a.health === "IDLE").length}
          icon="spark"
        />
      </div>

      <Panel title="What is not monitored">
        <ul className="flex flex-col gap-3">
          {data.missingTelemetry.map((m) => (
            <li key={m.id} className="border-b border-line/30 pb-3 last:border-0 last:pb-0">
              <p className="text-body-sm font-medium text-content">{m.label}</p>
              <p className="mt-1 text-pretty text-caption text-content-secondary">{m.reason}</p>
              <p className="mt-1 text-pretty text-caption text-content-muted">
                <span className="font-medium">Needs:</span> {m.needs}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-pretty text-caption text-content-muted">
          Requests, errors and latency percentiles all need a metrics store the platform does not
          have. Drawing a chart from single samples would look like monitoring and mislead during
          the one hour it matters.
        </p>
      </Panel>
    </div>
  );
}
