"use client";

import { useEffect, useState } from "react";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { useWorkspace } from "@/context/WorkspaceProvider";
import { workspaceApi, type Escalation } from "@/lib/api";
import type { Analytics } from "@/lib/workspace";

/**
 * Analytics.
 *
 * The scope is stated on the page rather than assumed. An employee reading
 * "open cases: 12" needs to know whether that is theirs or the whole team's —
 * the same number means two different things, and the API has already decided
 * which one they are allowed to see.
 */
export default function AnalyticsPage() {
  const { can } = useWorkspace();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [escalations, setEscalations] = useState<Escalation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    workspaceApi
      .analytics()
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load figures.");
      });

    // Only asked for when they hold the capability. Requesting it anyway would
    // produce a 403 in the console on every page load for most of the staff.
    if (can("work.read.all")) {
      workspaceApi
        .escalations()
        .then((data) => {
          if (!cancelled) setEscalations(data.escalations);
        })
        .catch(() => {
          if (!cancelled) setEscalations([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [can]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Analytics</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          {analytics
            ? analytics.scope === "TEAM"
              ? "Across the whole operation."
              : "Your own work only."
            : "Loading…"}
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {analytics ? (
          <>
            <Stat label="Open cases" value={analytics.openCases} icon="layers" />
            <Stat
              label="Overdue"
              value={analytics.overdueCases}
              tone={analytics.overdueCases > 0 ? "danger" : "success"}
              icon="clock"
            />
            <Stat
              label="Resolved today"
              value={analytics.resolvedToday}
              tone="success"
              icon="check"
            />
            <Stat label="Resolved this week" value={analytics.resolvedThisWeek} icon="chart" />
            <Stat
              label="Average resolution"
              value={
                analytics.averageResolutionMinutes === null
                  ? "—"
                  : `${Math.max(1, Math.round(analytics.averageResolutionMinutes / 60))}h`
              }
              hint={
                analytics.averageResolutionMinutes === null
                  ? "Nothing resolved in the last seven days"
                  : "Resolved work only, last seven days"
              }
              icon="bolt"
            />
          </>
        ) : (
          [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-card border border-line/50 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-16" />
            </div>
          ))
        )}
      </div>

      {can("work.read.all") ? (
        <Panel title="Needs a team lead">
          {escalations === null ? (
            <Skeleton className="h-16 w-full" />
          ) : escalations.length === 0 ? (
            <Empty>Nothing is breaching or unassigned.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {escalations.slice(0, 12).map((item) => (
                <li
                  key={item.workItemId}
                  className="border-b border-line/30 pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-body-sm font-medium text-content">{item.reason}</p>
                  <p className="text-caption text-content-secondary">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <p className="text-caption text-content-muted">
          Team-wide figures and escalations are available to team leads.
        </p>
      )}
    </div>
  );
}
