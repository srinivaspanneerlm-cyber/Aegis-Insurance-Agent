"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
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
/**
 * What each escalation code means, in words.
 *
 * `reason` is an enum — BREACHED, AT_RISK, UNASSIGNED, STALLED — and the page
 * printed it as the headline. A team lead reading a screen of shouted database
 * values is reading the schema, not the operation.
 */
const ESCALATION_LABELS: Record<string, string> = {
  BREACHED: "Past its promised time",
  AT_RISK: "About to breach",
  UNASSIGNED: "Nobody owns it",
  STALLED: "Stalled",
};

const ESCALATION_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  BREACHED: "danger",
  AT_RISK: "warning",
  UNASSIGNED: "warning",
  STALLED: "neutral",
};

/** How many escalations the panel shows before it says it is holding back. */
const ESCALATION_LIMIT = 12;

/**
 * Average resolution, in a unit that does not overstate it.
 *
 * This read `Math.max(1, Math.round(minutes / 60))h`, so a team resolving work
 * in ten minutes was reported as taking an hour — the floor of 1 turned every
 * fast operation into a mediocre one. Under 90 minutes it is now stated in
 * minutes, which is the unit the figure is actually accurate to.
 */
function formatResolution(minutes: number): string {
  if (minutes < 90) return `${Math.max(1, Math.round(minutes))}m`;
  return `${Math.round(minutes / 60)}h`;
}

export default function AnalyticsPage() {
  const { can } = useWorkspace();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [escalations, setEscalations] = useState<Escalation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from an empty list. A failed check rendered as "Nothing is
  // breaching or unassigned", which is the most dangerous thing this panel can
  // say: it reports all-clear when it does not know.
  const [escalationsFailed, setEscalationsFailed] = useState(false);

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
          if (!cancelled) setEscalationsFailed(true);
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
                  : formatResolution(analytics.averageResolutionMinutes)
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
          {escalationsFailed ? (
            <Empty icon="close">
              The escalation check could not be run, so this panel does not know whether anything is
              breaching. Try again shortly.
            </Empty>
          ) : escalations === null ? (
            <Skeleton className="h-16 w-full" />
          ) : escalations.length === 0 ? (
            <Empty icon="check">Nothing is breaching or unassigned.</Empty>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {escalations.slice(0, ESCALATION_LIMIT).map((item) => (
                  <li
                    key={item.workItemId}
                    className="border-b border-line/30 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ESCALATION_TONE[item.reason] ?? "neutral"}>
                        {ESCALATION_LABELS[item.reason] ?? item.reason}
                      </Badge>
                      {/* The id was already here and nothing used it, so a lead
                          reading "past its promised time" had to go and find
                          the case by hand. */}
                      <Link
                        href={`/work/${item.workItemId}`}
                        className="focus-ring rounded text-caption font-medium text-brand"
                      >
                        Open the case
                      </Link>
                    </div>
                    <p className="mt-1 text-body-sm text-content-secondary">{item.detail}</p>
                  </li>
                ))}
              </ul>

              {escalations.length > ESCALATION_LIMIT ? (
                <p role="status" className="mt-4 text-pretty text-caption text-content-muted">
                  Showing the {ESCALATION_LIMIT} most urgent of {escalations.length}. The rest are
                  not listed here.
                </p>
              ) : null}
            </>
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
