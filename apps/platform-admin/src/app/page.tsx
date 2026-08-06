"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { useConsole } from "@/context/ConsoleProvider";
import { platformApi } from "@/lib/api";
import { HEALTH_TONE, STATUS_TONE, formatBytes, formatUptime, type Overview } from "@/lib/platform";

/**
 * The operator's front page.
 *
 * Infrastructure first. Everything else on this platform is downstream of
 * whether the database answers, and an operator opening this during an incident
 * should not scroll past tenant counts to find out.
 */
export default function DashboardPage() {
  const { session } = useConsole();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .overview()
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

  if (error) return <Empty icon="close">{error}</Empty>;
  if (!data)
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Skeleton className="h-9 w-72" />
        <p role="status" className="sr-only">
          Loading the platform overview.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );

  const firstName = session?.user.name?.trim().split(/\s+/)[0];
  const degraded = data.components.filter((c) => c.status === "DOWN" || c.status === "DEGRADED");
  const { host, process: proc } = data.resources;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">
          {firstName ? `Good day, ${firstName}` : "Platform console"}
        </h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Live as at{" "}
          {new Date(data.generatedAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          . Every figure is a point-in-time reading, not a trend.
        </p>
      </header>

      {degraded.length > 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 px-4 py-3">
          <Icon name="bolt" size={18} className="mt-0.5 shrink-0" />
          <p className="text-body-sm text-content">
            <span className="font-medium">{degraded.map((c) => c.name).join(", ")}</span> —{" "}
            {degraded[0]?.detail}
          </p>
        </div>
      ) : null}

      <Panel
        title="Infrastructure"
        action={
          <Link
            href="/infrastructure"
            className="focus-ring rounded text-caption font-semibold text-brand"
          >
            Details
          </Link>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.components.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-control border border-line/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-content">{c.name}</p>
                <p className="text-caption text-content-muted">
                  {c.implementation}
                  {c.latencyMs !== null ? ` · ${c.latencyMs}ms` : ""}
                </p>
              </div>
              <Badge tone={STATUS_TONE[c.status]}>{c.status.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={data.identity.customers} icon="users" />
        <Stat label="Employees" value={data.identity.employees} icon="briefcase" />
        <Stat label="Admins" value={data.identity.admins} icon="building" />
        <Stat label="Operators" value={data.identity.operators} icon="shield" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Failed sign-ins today"
          value={data.security.failedLoginsToday}
          tone={data.security.failedLoginsToday > 20 ? "danger" : "neutral"}
          icon="lock"
        />
        <Stat
          label="Permission denials today"
          value={data.security.permissionDenialsToday}
          icon="shield"
        />
        <Stat
          label="Accounts locked"
          value={data.security.accountsLockedNow}
          tone={data.security.accountsLockedNow > 0 ? "warning" : "success"}
          icon="clock"
        />
        <Stat
          label="Organizations"
          value={Object.values(data.organizations).reduce((a, b) => a + b, 0)}
          icon="building"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Host">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-caption uppercase text-content-muted">Memory used</dt>
              <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                {host.usedMemoryPercent}%
              </dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-content-muted">Cores</dt>
              <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                {host.cores}
              </dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-content-muted">Load per core</dt>
              <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                {host.loadAverageMeaningful ? (host.loadPerCore ?? "—") : "n/a"}
              </dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-content-muted">Process heap</dt>
              <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                {formatBytes(proc.heapUsedBytes)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-caption text-content-muted">
            Node {proc.nodeVersion} · up {formatUptime(proc.uptimeSeconds)}
            {!host.loadAverageMeaningful
              ? " · load average is not meaningful on this platform"
              : ""}
          </p>
        </Panel>

        <Panel
          title="AI estate"
          action={
            <Link
              href="/ai-governance"
              className="focus-ring rounded text-caption font-semibold text-brand"
            >
              Governance
            </Link>
          }
        >
          <ul className="flex flex-col gap-3">
            {data.ai.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-body-sm text-content">{s.name}</span>
                <Badge tone={HEALTH_TONE[s.health as keyof typeof HEALTH_TONE] ?? "neutral"}>
                  {s.health}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Not measured">
        <div className="rounded-control border border-dashed border-line/50 p-4">
          <p className="text-body-sm font-semibold text-content-secondary">Revenue</p>
          <p className="mt-1 text-pretty text-caption text-content-muted">{data.revenue.reason}</p>
          <p className="mt-1 text-pretty text-caption text-content-muted">
            <span className="font-medium">Needs:</span> {data.revenue.needs}
          </p>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {data.missingTelemetry.map((m) => (
            <li key={m.id} className="rounded-control border border-dashed border-line/50 p-4">
              <p className="text-body-sm font-semibold text-content-secondary">{m.label}</p>
              <p className="mt-1 text-pretty text-caption text-content-muted">{m.reason}</p>
              <p className="mt-1 text-pretty text-caption text-content-muted">
                <span className="font-medium">Needs:</span> {m.needs}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
