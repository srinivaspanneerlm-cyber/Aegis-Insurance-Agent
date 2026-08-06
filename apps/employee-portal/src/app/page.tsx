"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { QueueTable } from "@/components/QueueTable";
import { Icon } from "@/components/Icon";
import { useWorkspace } from "@/context/WorkspaceProvider";
import { workspaceApi } from "@/lib/api";
import { isOverdue, type Analytics, type WorkItem } from "@/lib/workspace";

/**
 * The employee home.
 *
 * Ordered by what somebody needs in the first five seconds of a shift: what is
 * late, what is due, then the numbers, then the reference material. A profile
 * card at the top would be the least useful thing on the screen — they know who
 * they are — so it sits in the corner where identity belongs.
 */
export default function DashboardPage() {
  const { profile, session, workload, can } = useWorkspace();
  const [queue, setQueue] = useState<WorkItem[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([workspaceApi.queue(), workspaceApi.analytics()]).then((results) => {
      if (cancelled) return;
      const [queueResult, analyticsResult] = results;
      if (queueResult.status === "fulfilled") setQueue(queueResult.value.items);
      else setFailed(true);
      if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const overdue = (queue ?? []).filter(isOverdue);
  const firstName = session?.user.name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-content">
            {firstName ? `Good day, ${firstName}` : "Your workspace"}
          </h1>
          <p className="mt-1 text-body-sm text-content-secondary">
            {profile
              ? `${profile.designation} · ${profile.department} · ${profile.branch}`
              : "Loading your details…"}
          </p>
        </div>

        {profile ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-card border border-line/50 bg-surface-raised/30 px-4 py-3">
            <dt className="text-caption text-content-muted">Employee ID</dt>
            <dd className="text-caption font-medium tabular-nums text-content">
              {profile.employeeCode}
            </dd>
            <dt className="text-caption text-content-muted">Status</dt>
            <dd className="text-caption">
              <Badge tone={profile.status === "ACTIVE" ? "success" : "warning"}>
                {profile.status}
              </Badge>
            </dd>
          </dl>
        ) : null}
      </header>

      {/* Workload first. It is the one thing that changes what somebody should
          do next, and burying it under statistics would waste it. */}
      {workload ? (
        <div
          className={
            workload.verdict === "OVERLOADED" || workload.verdict === "AT_CAPACITY"
              ? "flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 px-4 py-3"
              : "flex items-start gap-3 rounded-card border border-line/50 bg-surface-raised/30 px-4 py-3"
          }
        >
          <Icon
            name={workload.verdict === "HEALTHY" ? "check" : "bolt"}
            size={18}
            className="mt-0.5 shrink-0"
          />
          <p className="text-body-sm text-content-secondary">
            <span className="font-medium text-content">
              {workload.verdict.replace("_", " ").toLowerCase()}
            </span>{" "}
            — {workload.advice}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analytics ? (
          <>
            <Stat label="Open cases" value={analytics.openCases} icon="layers" />
            <Stat
              label="Overdue"
              value={analytics.overdueCases}
              tone={analytics.overdueCases > 0 ? "danger" : "success"}
              hint={analytics.overdueCases > 0 ? "Past the promised time" : "Nothing late"}
              icon="clock"
            />
            <Stat
              label="Resolved today"
              value={analytics.resolvedToday}
              tone="success"
              icon="check"
            />
            <Stat
              label="Avg. resolution"
              value={
                analytics.averageResolutionMinutes === null
                  ? "—"
                  : formatMinutes(analytics.averageResolutionMinutes)
              }
              hint="Over the last seven days"
              icon="chart"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-card border border-line/50 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-16" />
            </div>
          ))
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Today's work"
          className="lg:col-span-2"
          action={
            <Link
              href="/tasks"
              className="focus-ring rounded text-caption font-semibold text-brand"
            >
              View all
            </Link>
          }
        >
          {failed ? (
            <Empty icon="close">We could not load your queue. Refresh to try again.</Empty>
          ) : queue === null ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <QueueTable items={queue.slice(0, 8)} />
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Needs attention now">
            {overdue.length === 0 ? (
              <Empty>Nothing is overdue.</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {overdue.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/work/${item.id}`}
                      className="focus-ring block rounded-control py-1"
                    >
                      <p className="text-body-sm font-medium text-content">{item.title}</p>
                      <p className="text-caption text-danger">{item.reference} · overdue</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {can("knowledge.read") ? (
            <Panel title="Assistance">
              <div className="flex flex-col gap-2">
                <Link
                  href="/assistant"
                  className="focus-ring flex items-center gap-3 rounded-control border border-line/50 px-3 py-2.5 transition-colors hover:bg-surface-raised/50"
                >
                  <Icon name="spark" size={17} className="shrink-0 text-brand" />
                  <span className="text-body-sm text-content">Ask the assistant</span>
                </Link>
                <Link
                  href="/knowledge"
                  className="focus-ring flex items-center gap-3 rounded-control border border-line/50 px-3 py-2.5 transition-colors hover:bg-surface-raised/50"
                >
                  <Icon name="book" size={17} className="shrink-0 text-brand" />
                  <span className="text-body-sm text-content">Search SOPs and guidelines</span>
                </Link>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
