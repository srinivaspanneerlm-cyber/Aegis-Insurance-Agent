"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { workspaceApi, type ActivityEvent } from "@/lib/api";

const TAKE = 50;

/** Event kinds, in words. The raw values are database enums. */
const EVENT_LABELS: Record<string, string> = {
  OPENED: "Opened",
  ASSIGNED: "Assigned",
  STATUS_CHANGED: "Status changed",
  STEP_COMPLETED: "Step completed",
  NOTE: "Note added",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CONTACTED: "Customer contacted",
  REOPENED: "Reopened",
};

const EVENT_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  OPENED: "info",
  RESOLVED: "success",
  ESCALATED: "danger",
  STATUS_CHANGED: "neutral",
  ASSIGNED: "neutral",
};

/**
 * Groups events under the day they happened.
 *
 * A flat list of fifty timestamps is a list nobody reads. Grouped here rather
 * than asked of the server because the endpoint returns one flat page and the
 * day boundary depends on the reader's timezone, which the server does not know.
 */
function groupByDay(events: readonly ActivityEvent[]): [string, ActivityEvent[]][] {
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const day = new Date(event.at).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const existing = groups.get(day);
    if (existing) existing.push(event);
    else groups.set(day, [event]);
  }
  return [...groups.entries()];
}

/**
 * Activity.
 *
 * /communication/activity has been live behind `work.read` — which every
 * employee holds — and nothing read it.
 *
 * The scope is stated at the top, because it is not what the page looks like.
 * The endpoint reads every work-item event on the platform, with no filter by
 * caller, assignee or department. A feed that looks personal and is not would
 * have somebody reading a colleague's escalation as their own.
 */
export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { events: rows } = await workspaceApi.activity(TAKE);
      setEvents(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Activity</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          Everything that has happened across the operation — not only your cases. For your own
          work, see{" "}
          <Link
            href="/tasks"
            className="focus-ring rounded text-brand underline underline-offset-4"
          >
            My Tasks
          </Link>
          .
        </p>
      </header>

      <Panel title={events ? `Last ${events.length} events` : "Loading"}>
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : events === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Empty>Nothing has happened yet.</Empty>
        ) : (
          <div className="flex flex-col gap-6">
            {groupByDay(events).map(([day, dayEvents]) => (
              <section key={day}>
                <h2 className="text-caption font-medium uppercase tracking-wide text-content-muted">
                  {day}
                </h2>
                <ol className="mt-3 flex flex-col gap-3">
                  {dayEvents.map((event) => (
                    <li
                      key={event.id}
                      className="border-b border-line/30 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={EVENT_TONE[event.kind] ?? "neutral"}>
                          {EVENT_LABELS[event.kind] ?? event.kind}
                        </Badge>
                        <Link
                          href={event.deepLink}
                          className="focus-ring rounded text-caption font-medium tabular-nums text-brand"
                        >
                          {event.reference}
                        </Link>
                        {event.department ? (
                          <span className="text-caption text-content-muted">
                            {event.department}
                          </span>
                        ) : null}
                        <time
                          dateTime={event.at}
                          className="ml-auto text-caption tabular-nums text-content-muted"
                        >
                          {new Date(event.at).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>

                      <p className="mt-1.5 text-pretty break-words text-body-sm text-content">
                        {event.summary}
                      </p>
                      {/* "Aegis" is what the server sends when the platform did
                          it rather than a person — worth keeping distinct from a
                          colleague's name. */}
                      <p className="mt-0.5 text-caption text-content-secondary">
                        {event.actorName === "Aegis"
                          ? "Done by the platform"
                          : `By ${event.actorName}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        {events && events.length >= TAKE ? (
          <p role="status" className="mt-4 text-pretty text-caption text-content-muted">
            Showing the {TAKE} most recent. Older activity is not listed — the endpoint returns one
            page and takes no date range.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
