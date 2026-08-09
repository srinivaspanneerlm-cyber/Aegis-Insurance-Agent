"use client";

import { useEffect, useState } from "react";
import { Empty, Panel, Skeleton } from "@/components/Cards";
import { MetricCard } from "@/components/MetricCard";
import { consoleApi } from "@/lib/api";
import type { Branch, Overview } from "@/lib/console";

/**
 * Business analytics.
 *
 * The KPIs the platform can actually compute, and an explicit account of the
 * ones it cannot. Growth, retention and claims ratio need history and revenue
 * the platform does not yet hold — saying so is more useful than a chart drawn
 * over three weeks of data and labelled "annual trend".
 */
export default function AnalyticsPage() {
  const [data, setData] = useState<{
    overview: Overview;
    trend: { date: string; count: number }[];
    branches: Branch[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .analytics()
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
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );

  const { overview, trend, branches } = data;
  const peak = Math.max(1, ...trend.map((d) => d.count));
  const resolvedInWindow = trend.reduce((sum, d) => sum + d.count, 0);

  // Split the window the server already sent rather than asking for a second
  // one. The endpoint takes no date range, so this is the only comparison
  // available without a backend change — and it is a real one.
  const half = Math.floor(trend.length / 2);
  const earlier = trend.slice(0, half).reduce((sum, d) => sum + d.count, 0);
  const recent = trend.slice(trend.length - half).reduce((sum, d) => sum + d.count, 0);
  // Null rather than Infinity when the earlier half is empty: "+∞%" is not a
  // finding, and 0 → 5 is better told as the two counts.
  const change = earlier === 0 ? null : Math.round(((recent - earlier) / earlier) * 100);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Business Analytics</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Operational performance over the last 30 days.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Customers"
          metric={overview.customers}
          icon="users"
          render={(v) => ({ value: v.total, hint: `${v.unverified} unverified` })}
        />
        <MetricCard
          label="Open cases"
          metric={overview.claims}
          icon="layers"
          render={(v) => ({ value: v.open, hint: `${v.overdue} overdue` })}
        />
        <MetricCard
          label="Renewals"
          metric={overview.renewals}
          icon="refresh"
          render={(v) => ({ value: v.total })}
        />
        <MetricCard
          label="Complaints"
          metric={overview.complaints}
          icon="phone"
          render={(v) => ({ value: v.total })}
        />
      </div>

      {/* The endpoint returns thirteen measures and this screen rendered
            eight. These five were in every payload and shown nowhere, so the
            analytics view could describe the caseload and not the estate
            carrying it. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <MetricCard
          label="KYC in flight"
          metric={overview.kyc}
          icon="users"
          render={(v) => ({ value: v.total })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Live sessions"
          metric={overview.system}
          icon="bolt"
          render={(v) => ({
            value: v.liveSessions,
            hint: `${v.failedLoginsToday} failed sign-in(s) today`,
          })}
        />
        {/* Direction, not just a total. A period sum with nothing to compare
              it against is a number rather than an analytic, and the comparison
              comes from the series already on the page. */}
        <div className="rounded-card border border-line/50 p-5">
          <p className="text-caption uppercase tracking-wide text-content-muted">
            Against the previous {half} days
          </p>
          {recent + earlier === 0 ? (
            <p className="mt-3 text-body-sm text-content-secondary">
              Nothing resolved in either half of this window, so there is no trend to report.
            </p>
          ) : (
            <>
              <p
                className={
                  change === null
                    ? "mt-3 text-h1 font-bold text-content"
                    : change >= 0
                      ? "mt-3 text-h1 font-bold text-success"
                      : "mt-3 text-h1 font-bold text-danger"
                }
              >
                {change === null ? "—" : `${change >= 0 ? "+" : ""}${change}%`}
              </p>
              <p className="mt-1 text-caption text-content-secondary">
                {recent} resolved in the last {half} days, {earlier} in the {half} before.
              </p>
              {change === null ? (
                <p className="mt-1 text-caption text-content-muted">
                  Nothing resolved in the earlier half, so a percentage would divide by zero. The
                  counts are given instead.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Panel title={`Cases resolved, last 30 days — ${resolvedInWindow} total`}>
        {resolvedInWindow === 0 ? (
          <Empty>Nothing resolved in this window yet.</Empty>
        ) : (
          <div
            className="flex h-40 items-end gap-0.5"
            role="img"
            aria-label={`Resolved per day, peaking at ${peak}`}
          >
            {trend.map((day) => (
              <div
                key={day.date}
                className="flex-1 rounded-t bg-brand/70"
                style={{
                  height: `${(day.count / peak) * 100}%`,
                  minHeight: day.count ? "2px" : "0",
                }}
                title={`${day.date}: ${day.count}`}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Branch comparison">
        {branches.length === 0 ? (
          <Empty icon="building">No employee records yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {branches.map((b) => (
              <li
                key={b.branch}
                className="flex items-center justify-between gap-4 border-b border-line/30 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-body-sm text-content">{b.branch}</p>
                  <p className="text-caption text-content-muted">
                    {b.active} active of {b.employees}
                  </p>
                </div>
                <div className="flex shrink-0 gap-6 text-right">
                  <div>
                    <p className="text-caption uppercase text-content-muted">Open</p>
                    <p className="text-body font-semibold tabular-nums text-content">
                      {b.openWork}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption uppercase text-content-muted">Overdue</p>
                    <p
                      className={`text-body font-semibold tabular-nums ${b.overdue > 0 ? "text-danger" : "text-content"}`}
                    >
                      {b.overdue}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="KPIs the platform cannot yet compute">
        <ul className="flex flex-col gap-3">
          {[
            ["Revenue and growth", overview.revenue],
            ["Customer satisfaction", overview.customerSatisfaction],
            ["Fraud signals", overview.fraudSignals],
            ["Document verification", overview.documentVerification],
          ].map(([label, metric]) => {
            const m = metric as Overview["revenue"];
            if (m.available) return null;
            return (
              <li
                key={label as string}
                className="border-b border-line/30 pb-3 last:border-0 last:pb-0"
              >
                <p className="text-body-sm font-medium text-content">{label as string}</p>
                <p className="mt-1 text-pretty text-caption text-content-secondary">{m.reason}</p>
                <p className="mt-1 text-pretty text-caption text-content-muted">
                  <span className="font-medium">Needs:</span> {m.needs}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-pretty text-caption text-content-muted">
          Retention, claims ratio and renewal rate additionally need more history than the platform
          has accumulated. A trend line over three weeks labelled &ldquo;annual&rdquo; would mislead
          more than it informs.
        </p>
      </Panel>
    </div>
  );
}
