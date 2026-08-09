"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type NotificationsPayload } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  POLICY: "Policy",
  CLAIM: "Claim",
  DOCUMENT: "Document",
  RENEWAL: "Renewal",
  SECURITY: "Security",
  ANNOUNCEMENT: "Announcement",
  MAINTENANCE: "Maintenance",
  AI_SUGGESTION: "Assistant",
  TASK: "Task",
  MESSAGE: "Message",
};

/**
 * What the platform has been telling this tenant's people.
 *
 * Delivery success is not shown here — it belongs to Reports, which reads the
 * delivery records. This is what was raised and whether it was read.
 */
export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .notifications()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load notifications.");
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Notifications</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          What the platform has raised for your people over the last {data?.windowDays ?? 30} days.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Unread"
              value={data.unread}
              tone={data.unread > 0 ? "warning" : "success"}
              icon="mail"
            />
            <Stat label="Read" value={data.byStatus.READ ?? 0} icon="check" />
            <Stat label="Archived" value={data.byStatus.ARCHIVED ?? 0} icon="layers" />
          </div>

          <Panel title="By category">
            {Object.keys(data.byCategory).length === 0 ? (
              <Empty>Nothing has been raised in this window.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.byCategory).map(([c, n]) => (
                  <Badge key={c}>
                    {CATEGORY_LABELS[c] ?? c} · {n}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Announcements">
            {data.announcements.length === 0 ? (
              <Empty>Nothing has been announced.</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.announcements.map((a) => (
                  <li key={a.id} className="border-b border-line/30 pb-3 last:border-0 last:pb-0">
                    <p className="text-body-sm font-medium text-content">{a.title}</p>
                    {a.body ? (
                      <p className="mt-0.5 text-pretty text-caption text-content-secondary">
                        {a.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-caption text-content-muted">
                      {a.publishedAt
                        ? new Date(a.publishedAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "not published"}
                      {a.audienceRealm !== "ALL" ? ` · ${a.audienceRealm}` : ""}
                      {a.audienceDepartment ? ` · ${a.audienceDepartment}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {/* Announcements are platform-wide. Leaving that unsaid would have
                them read as this tenant's own. */}
            <p className="mt-4 text-pretty text-caption text-content-muted">
              {data.announcementScope.reason}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
