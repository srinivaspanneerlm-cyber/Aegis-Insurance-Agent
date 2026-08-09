"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { MetricCard } from "@/components/MetricCard";
import { Icon } from "@/components/Icon";
import { useConsole } from "@/context/ConsoleProvider";
import { consoleApi } from "@/lib/api";
import { HEALTH_TONE, type DashboardPayload } from "@/lib/console";

/**
 * The enterprise dashboard.
 *
 * Ordered by what would make somebody act: compliance first, then live
 * operational load, then the business counts, then the estate. A revenue tile
 * at the top would be the conventional choice and the wrong one — this platform
 * does not record revenue, and the first card should never be the one that has
 * to explain itself.
 */
export default function DashboardPage() {
  const { session, can } = useConsole();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .dashboard()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load the console.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const { overview, compliance, branches, trend, aiSystems } = data;
  const firstName = session?.user.name?.trim().split(/\s+/)[0];
  const peak = Math.max(1, ...trend.map((d) => d.count));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-content">
            {firstName ? `Good day, ${firstName}` : "Enterprise overview"}
          </h1>
          <p className="mt-1 text-body-sm text-content-secondary">
            Business health across the whole operation, as at{" "}
            {new Date(overview.generatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        </div>

        {can("analytics.read") ? (
          <Link
            href="/reports"
            className="focus-ring rounded-control border border-line bg-surface-raised px-4 py-2 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
          >
            Generate a report
          </Link>
        ) : null}
      </header>

      {/* Compliance first: it is the only panel here that can require somebody
          to act today, and burying it under counts would waste it. */}
      <Link
        href="/compliance"
        className={
          compliance.verdict === "ACTION_REQUIRED"
            ? "focus-ring flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 px-4 py-3"
            : compliance.verdict === "ATTENTION"
              ? "focus-ring flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 px-4 py-3"
              : "focus-ring flex items-start gap-3 rounded-card border border-line/50 bg-surface-raised/30 px-4 py-3"
        }
      >
        <Icon
          name={compliance.verdict === "CLEAR" ? "check" : "shield"}
          size={18}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-medium text-content">
            {compliance.verdict === "ACTION_REQUIRED"
              ? `${compliance.critical} critical finding${compliance.critical === 1 ? "" : "s"} need attention now`
              : compliance.verdict === "ATTENTION"
                ? `${compliance.high} finding${compliance.high === 1 ? "" : "s"} to review`
                : "All compliance checks passing"}
          </p>
          <p className="mt-0.5 text-caption text-content-secondary">
            {compliance.passing} of {compliance.checksRun} checks clear. {compliance.disclaimer}
          </p>
        </div>
        <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-content-muted" />
      </Link>

      {/* Live operational load. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Open cases"
          metric={overview.claims}
          icon="layers"
          render={(v) => ({ value: v.open, hint: `${v.total} claims in total` })}
        />
        <MetricCard
          label="Overdue"
          metric={overview.claims}
          icon="clock"
          tone="danger"
          render={(v) => ({
            value: v.overdue,
            hint: v.overdue > 0 ? "Past the promised time" : "Nothing late",
          })}
        />
        <MetricCard
          label="Avg. resolution"
          metric={overview.claims}
          icon="chart"
          render={(v) => ({
            value: v.averageResolutionHours === null ? "—" : `${v.averageResolutionHours}h`,
            hint: "Resolved work, last 30 days",
          })}
        />
        <MetricCard
          label="Live sessions"
          metric={overview.system}
          icon="bolt"
          render={(v) => ({
            value: v.liveSessions,
            hint: `${v.failedLoginsToday} failed sign-in(s) today`,
          })}
        />
      </div>

      {/* Business counts. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Customers"
          metric={overview.customers}
          icon="users"
          render={(v) => ({ value: v.total, hint: `${v.newThisWeek} new this week` })}
        />
        <MetricCard
          label="Active employees"
          metric={overview.employees}
          icon="briefcase"
          render={(v) => ({ value: v.active, hint: `${v.total} on record` })}
        />
        <MetricCard
          label="Active policies"
          metric={overview.policies}
          icon="shield"
          render={(v) => ({ value: v.active, hint: `${v.insurers} insurer(s)` })}
        />
        <MetricCard
          label="Documents held"
          metric={overview.documents}
          icon="book"
          render={(v) => ({ value: v.total, hint: `${v.thisWeek} this week` })}
        />
      </div>

      {/* Work waiting on somebody. The endpoint has always returned these three
          and the page rendered none of them, so the console showed the estate
          and not the queue inside it. No links yet — the screens they belong to
          are not built, and a tile linking to a 404 is worse than a tile. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Renewals"
          metric={overview.renewals}
          icon="refresh"
          render={(v) => ({
            value: v.total,
            hint: v.total > 0 ? "Coming up for renewal" : "None outstanding",
          })}
        />
        <MetricCard
          label="KYC"
          metric={overview.kyc}
          icon="users"
          render={(v) => ({
            value: v.total,
            hint: v.total > 0 ? "Identity checks in flight" : "None outstanding",
          })}
        />
        <MetricCard
          label="Complaints"
          metric={overview.complaints}
          icon="mail"
          tone={
            overview.complaints.available && overview.complaints.value.total > 0
              ? "warning"
              : "neutral"
          }
          render={(v) => ({
            value: v.total,
            hint: v.total > 0 ? "Open and unresolved" : "None open",
          })}
        />
      </div>

      {/* The four the platform cannot measure, grouped so they read as one known
          gap rather than four scattered apologies. */}
      <section>
        <h2 className="mb-3 text-body-sm font-semibold text-content">Not yet measured</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Revenue" metric={overview.revenue} render={() => ({ value: "—" })} />
          <MetricCard
            label="Customer satisfaction"
            metric={overview.customerSatisfaction}
            render={() => ({ value: "—" })}
          />
          <MetricCard
            label="Fraud signals"
            metric={overview.fraudSignals}
            render={() => ({ value: "—" })}
          />
          <MetricCard
            label="Document verification"
            metric={overview.documentVerification}
            render={() => ({ value: "—" })}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Cases resolved, last 14 days" className="lg:col-span-2">
          {trend.every((d) => d.count === 0) ? (
            <Empty>Nothing resolved in this window yet.</Empty>
          ) : (
            // A bar chart drawn with divs. No charting library for four dozen
            // numbers — it would be more bytes than the rest of the page.
            <div
              className="flex h-40 items-end gap-1"
              role="img"
              aria-label={`Cases resolved per day over ${trend.length} days, peaking at ${peak}`}
            >
              {trend.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand/70"
                    style={{
                      height: `${(day.count / peak) * 100}%`,
                      minHeight: day.count ? "2px" : "0",
                    }}
                    title={`${day.date}: ${day.count}`}
                  />
                  <span className="text-[0.5625rem] tabular-nums text-content-muted">
                    {day.date.slice(8)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="AI estate"
          action={
            can("platform.configure") ? (
              <Link
                href="/ai-systems"
                className="focus-ring rounded text-caption font-semibold text-brand"
              >
                Monitor
              </Link>
            ) : null
          }
        >
          <ul className="flex flex-col gap-3">
            {aiSystems.map((system) => (
              <li key={system.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-body-sm text-content">{system.name}</span>
                <Badge tone={HEALTH_TONE[system.health as keyof typeof HEALTH_TONE] ?? "neutral"}>
                  {system.health}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Branches">
        {branches.length === 0 ? (
          <Empty icon="building">
            No employee records yet, so there are no branches to compare.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Branch
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Active staff
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Open work
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.branch} className="border-b border-line/30 last:border-0">
                    <td className="py-2.5 pr-4 text-body-sm text-content">{branch.branch}</td>
                    <td className="py-2.5 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {branch.active} / {branch.employees}
                    </td>
                    <td className="py-2.5 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {branch.openWork}
                    </td>
                    <td className="py-2.5 text-body-sm tabular-nums">
                      <span
                        className={
                          branch.overdue > 0
                            ? "font-semibold text-danger"
                            : "text-content-secondary"
                        }
                      >
                        {branch.overdue}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-16 w-full" />
      <p role="status" className="sr-only">
        Loading the enterprise overview.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="rounded-card border border-line/50 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
