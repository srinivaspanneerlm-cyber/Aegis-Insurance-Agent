"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@aegis/utils";
import {
  CATEGORY_META,
  PRIORITY_META,
  TONE_BORDER,
  timeAgo,
  type NotificationItem,
} from "../lib/types";

export interface NotificationCenterProps {
  notifications: NotificationItem[];
  unreadCount: number;
  loading?: boolean;
  onMarkRead: (ids: string[]) => void;
  onArchive: (ids: string[]) => void;
  onOpen?: (item: NotificationItem) => void;
}

/**
 * The notification bell and its panel.
 *
 * Opens on click, never on hover — a panel that appears while somebody is
 * moving their pointer across a toolbar is a panel that covers what they were
 * reaching for. Closes on Escape and on a click outside, and returns focus to
 * the bell, because a keyboard user who opens this must be able to leave it.
 *
 * The unread count is announced politely rather than assertively. A number that
 * interrupts a screen reader mid-sentence every time a colleague posts is a
 * number that gets the whole application muted.
 */
export function NotificationCenter({
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onArchive,
  onOpen,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const unread = notifications.filter((n) => n.status === "UNREAD");

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications, none unread"
        }
        className="focus-ring rounded-control border-line/60 text-content-secondary hover:text-content relative border px-3 py-2 transition-colors"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 ? (
          <span className="bg-danger text-status-fg rounded-pill absolute -top-1 -right-1 min-w-[1.15rem] px-1 text-[0.625rem] leading-[1.15rem] font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {/* Polite, so a colleague posting does not interrupt what somebody is
          reading. */}
      <span role="status" aria-live="polite" className="sr-only">
        {unreadCount > 0 ? `${unreadCount} unread notifications` : ""}
      </span>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="rounded-card border-line/60 bg-surface absolute right-0 z-50 mt-2 flex max-h-[32rem] w-[min(24rem,calc(100vw-2rem))] flex-col border shadow-lg"
        >
          <div className="border-line/40 flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-body-sm text-content font-semibold">Notifications</h2>
            {unread.length > 0 ? (
              <button
                type="button"
                onClick={() => onMarkRead(unread.map((n) => n.id))}
                className="focus-ring rounded-control text-caption text-brand px-2 py-1 font-medium"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-body-sm text-content-muted p-6 text-center">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="text-body-sm text-content-muted p-6 text-center text-pretty">
                Nothing here yet. We will tell you when something needs you.
              </p>
            ) : (
              <ul className="divide-line/30 divide-y">
                {notifications.map((item) => {
                  const meta = CATEGORY_META[item.category] ?? {
                    label: item.category,
                    tone: "neutral" as const,
                  };
                  const priority = PRIORITY_META[item.priority];

                  return (
                    <li
                      key={item.id}
                      className={cn("p-4", item.status === "UNREAD" && "bg-brand/5")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "rounded-pill shrink-0 border px-2 py-0.5 text-[0.625rem] font-semibold",
                            TONE_BORDER[meta.tone]
                          )}
                        >
                          {meta.label}
                        </span>
                        <time
                          dateTime={item.createdAt}
                          className="text-caption text-content-muted shrink-0"
                        >
                          {timeAgo(item.createdAt)}
                        </time>
                      </div>

                      <p className="text-body-sm text-content mt-1.5 font-medium text-pretty">
                        {item.title}
                        {priority.label ? (
                          <span
                            className={cn(
                              "text-caption ml-2 font-semibold",
                              TONE_BORDER[priority.tone].split(" ")[1]
                            )}
                          >
                            {priority.label}
                          </span>
                        ) : null}
                      </p>

                      {item.body ? (
                        <p className="text-caption text-content-secondary mt-1 text-pretty">
                          {item.body}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.deepLink && onOpen ? (
                          <button
                            type="button"
                            onClick={() => {
                              onMarkRead([item.id]);
                              onOpen(item);
                            }}
                            className="focus-ring rounded-control text-caption text-brand font-medium"
                          >
                            Open
                          </button>
                        ) : null}
                        {item.status === "UNREAD" ? (
                          <button
                            type="button"
                            onClick={() => onMarkRead([item.id])}
                            className="focus-ring rounded-control text-caption text-content-secondary"
                          >
                            Mark read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onArchive([item.id])}
                          className="focus-ring rounded-control text-caption text-content-muted"
                        >
                          Archive
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
