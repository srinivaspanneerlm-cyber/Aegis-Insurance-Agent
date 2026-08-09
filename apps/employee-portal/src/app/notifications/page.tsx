"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { workspaceApi, type EmployeeNotification, type NotificationStatus } from "@/lib/api";

const TABS: { key: NotificationStatus; label: string }[] = [
  { key: "UNREAD", label: "Unread" },
  { key: "READ", label: "Read" },
  { key: "ARCHIVED", label: "Archived" },
];

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
 * A relative portal path, or nothing.
 *
 * The server documents `deepLink` as relative and never absolute, for a stated
 * reason: an absolute URL in a notification is a phishing vector. Checking it
 * again here costs one comparison and means a row written by any future
 * producer — or by a bug — cannot navigate somebody off the portal. `//host` is
 * rejected too: it looks relative and is not.
 */
function safePath(link: string | null): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  return link;
}

/**
 * Notifications.
 *
 * The nav has pointed here and said "coming soon" while the endpoints — list,
 * unread count, mark read, archive — were all live. This reads them.
 *
 * Read and archive are separate on purpose, because the server treats them
 * separately: reading is an acknowledgement, archiving takes it out of the list
 * for good. Collapsing them into one "dismiss" would make the third state the
 * schema added unreachable from the only screen that shows it.
 */
export default function NotificationsPage() {
  const [tab, setTab] = useState<NotificationStatus>("UNREAD");
  const [items, setItems] = useState<EmployeeNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Switching tabs quickly must not let a slow earlier response overwrite a
  // later one — the list would then disagree with the selected tab.
  const ticket = useRef(0);

  const load = useCallback(async (status: NotificationStatus) => {
    const mine = ++ticket.current;
    setItems(null);
    setError(null);
    try {
      const { notifications } = await workspaceApi.notifications(status);
      if (mine !== ticket.current) return;
      setItems(notifications);
    } catch (err) {
      if (mine !== ticket.current) return;
      setError(err instanceof Error ? err.message : "Could not load your notifications.");
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const act = useCallback(
    async (id: string, action: "read" | "archive") => {
      setBusy(id);
      setActionError(null);
      try {
        if (action === "read") await workspaceApi.markNotificationsRead([id]);
        else await workspaceApi.archiveNotifications([id]);
        // Re-read rather than removing the row locally: the server decides what
        // belongs in this tab, and guessing here is how a list starts drifting
        // from the truth it is meant to report.
        await load(tab);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(null);
      }
    },
    [load, tab]
  );

  const markAllRead = useCallback(async () => {
    if (!items || items.length === 0) return;
    setBusy("all");
    setActionError(null);
    try {
      await workspaceApi.markNotificationsRead(items.map((n) => n.id));
      await load(tab);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  }, [items, load, tab]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Notifications</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          What the platform has told you, and what you have already dealt with.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Notification status" className="flex flex-wrap gap-2">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              onClick={() => setTab(entry.key)}
              className={
                tab === entry.key
                  ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-body-sm font-medium text-content"
                  : "focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary"
              }
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === "UNREAD" && items && items.length > 0 ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={busy !== null}
            className="focus-ring rounded-control border border-line/50 px-3 py-1.5 text-body-sm text-content-secondary disabled:opacity-50"
          >
            {busy === "all" ? "Marking…" : `Mark all ${items.length} as read`}
          </button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="text-body-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <Panel
        title={items ? `${items.length} notification${items.length === 1 ? "" : "s"}` : "Loading"}
      >
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : items === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty icon="check">
            {tab === "UNREAD"
              ? "Nothing unread. Anything new appears here."
              : tab === "READ"
                ? "Nothing read and still in your list."
                : "Nothing archived."}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const path = safePath(item.deepLink);
              return (
                <li
                  key={item.id}
                  className="rounded-control border border-line/40 bg-surface-raised/20 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                    {/* Urgency in a word as well as a colour — this is the field
                        that decides what somebody opens first. */}
                    {item.priority === "URGENT" || item.priority === "HIGH" ? (
                      <Badge tone={item.priority === "URGENT" ? "danger" : "warning"}>
                        {item.priority === "URGENT" ? "Urgent" : "High"}
                      </Badge>
                    ) : null}
                    {item.status === "UNREAD" ? (
                      <span className="text-caption font-medium text-brand">Unread</span>
                    ) : null}
                    <time
                      dateTime={item.createdAt}
                      className="ml-auto text-caption text-content-muted"
                    >
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>

                  <p className="mt-2 text-body-sm font-medium text-content">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 text-pretty text-body-sm text-content-secondary">
                      {item.body}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {path ? (
                      <a
                        href={path}
                        className="focus-ring inline-flex items-center gap-1 rounded text-caption font-medium text-brand"
                      >
                        <Icon name="compass" size={12} aria-hidden="true" />
                        Open
                      </a>
                    ) : null}
                    {item.status === "UNREAD" ? (
                      <button
                        type="button"
                        onClick={() => void act(item.id, "read")}
                        disabled={busy !== null}
                        className="focus-ring rounded text-caption text-content-secondary disabled:opacity-50"
                      >
                        Mark as read
                      </button>
                    ) : null}
                    {item.status !== "ARCHIVED" ? (
                      <button
                        type="button"
                        onClick={() => void act(item.id, "archive")}
                        disabled={busy !== null}
                        className="focus-ring rounded text-caption text-content-secondary disabled:opacity-50"
                      >
                        {busy === item.id ? "Working…" : "Archive"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
