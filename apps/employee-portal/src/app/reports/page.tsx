"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { workspaceApi, type CommunicationReport } from "@/lib/api";

const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  SMS: "Text message",
  PUSH: "Push",
  // Present in the delivery records and absent from the preferences list, so it
  // would otherwise render as the raw enum.
  REALTIME: "Live (socket)",
};

const STATUS_LABELS: Record<string, string> = {
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  SUPPRESSED: "Suppressed",
  PENDING: "Pending",
};

/**
 * Reports.
 *
 * The nav has pointed here and said "coming soon" while
 * /communication/analytics/overview was live behind `analytics.read`, which
 * every employee holds.
 *
 * The endpoint is unusually careful about what it will and will not claim, and
 * this page carries that through rather than flattening it into figures:
 *
 *  · a success rate of `null` means nothing was tried, and is shown as that
 *    rather than as 0%, which reads as total failure;
 *  · suppressions are reported apart from failures, because "no SMS provider
 *    configured" and "the message did not arrive" need opposite fixes;
 *  · engagement is declared unavailable with the reason, because nothing links
 *    a read back to the delivery that prompted it, and a number here would be a
 *    guess dressed as a measurement.
 */
export default function ReportsPage() {
  const [report, setReport] = useState<CommunicationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .communicationReport()
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the report.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Reports</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          What the platform sent over the last {report?.windowDays ?? 7} days, and whether it
          arrived. Your own caseload figures are on{" "}
          <a
            href="/analytics"
            className="focus-ring rounded text-brand underline underline-offset-4"
          >
            Analytics
          </a>
          .
        </p>
      </header>

      {!report ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Attempted" value={report.delivery.attempted} icon="mail" />
            <Stat label="Succeeded" value={report.delivery.succeeded} tone="success" icon="check" />
            <Stat
              label="Suppressed"
              value={report.delivery.suppressed}
              tone={report.delivery.suppressed > 0 ? "warning" : "neutral"}
              icon="lock"
            />
            {/* Null means no traffic, and says so. Rendering it as 0% would send
                somebody hunting for a fault that does not exist. */}
            <Stat
              label="Delivered"
              value={
                report.delivery.successRate === null
                  ? "No traffic"
                  : `${report.delivery.successRate}%`
              }
              tone={
                report.delivery.successRate === null
                  ? "neutral"
                  : report.delivery.successRate >= 95
                    ? "success"
                    : "warning"
              }
              icon="chart"
            />
          </div>

          <p className="text-pretty text-caption text-content-muted">
            {report.delivery.successRateNote}
          </p>

          <Panel title="By channel">
            {report.delivery.byChannel.length === 0 ? (
              <Empty>Nothing was sent in this window.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.delivery.byChannel.map((row) => (
                  <li
                    key={row.channel}
                    className="flex flex-wrap items-center gap-2 rounded-control border border-line/40 px-4 py-3"
                  >
                    <span className="text-body-sm font-medium text-content">
                      {CHANNEL_LABELS[row.channel] ?? row.channel}
                    </span>
                    <span className="ml-auto flex flex-wrap gap-2">
                      {Object.entries(row.counts).map(([status, count]) => (
                        <Badge
                          key={status}
                          tone={
                            status === "FAILED"
                              ? "danger"
                              : status === "SUPPRESSED"
                                ? "warning"
                                : status === "DELIVERED" || status === "SENT"
                                  ? "success"
                                  : "neutral"
                          }
                        >
                          {STATUS_LABELS[status] ?? status}: {count}
                        </Badge>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {report.delivery.suppressionReasons.length > 0 ? (
            <Panel title="Why messages were suppressed">
              {/* Kept apart from failures on purpose. A missing provider and an
                  undelivered message look the same in a total and need opposite
                  fixes. */}
              <ul className="flex flex-col gap-2">
                {report.delivery.suppressionReasons.map((row) => (
                  <li
                    key={row.reason}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-body-sm"
                  >
                    <span className="text-content-secondary">{row.reason}</span>
                    <span className="tabular-nums text-content">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Collaboration">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Conversations started"
                value={report.collaboration.conversationsStarted}
                icon="mail"
              />
              <Stat
                label="Messages posted"
                value={report.collaboration.messagesPosted}
                icon="users"
              />
              <Stat
                label="Announcements"
                value={report.collaboration.announcementsPublished}
                icon="bolt"
              />
            </div>
            <p className="mt-4 text-caption text-content-muted">
              {report.unreadNotifications} notification
              {report.unreadNotifications === 1 ? " is" : "s are"} unread across the platform.
            </p>
          </Panel>

          {/* The honest gap, carried through rather than hidden. A report that
              silently omits what it cannot measure teaches people it measured
              everything. */}
          <Panel title="What this report cannot tell you">
            <div className="flex items-start gap-3">
              <Icon name="eye" size={18} className="mt-0.5 shrink-0 text-content-muted" />
              <div>
                <p className="text-body-sm font-medium text-content">
                  Whether people read what they were sent.
                </p>
                <p className="mt-1 text-pretty text-body-sm text-content-secondary">
                  {report.engagementRate.reason}
                </p>
                <p className="mt-2 text-pretty text-caption text-content-muted">
                  It would need: {report.engagementRate.needs}
                </p>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
