"use client";

import { cn } from "@aegis/utils";
import { CATEGORY_META, TONE_BORDER, timeAgo, type InboxItem } from "../lib/types";

export interface InboxListProps {
  items: InboxItem[];
  selectedId?: string | null;
  loading?: boolean;
  onSelect: (item: InboxItem) => void;
}

const KIND_LABEL: Record<InboxItem["itemKind"], string> = {
  conversation: "Conversation",
  notification: "Notification",
  announcement: "Announcement",
};

/**
 * One list across conversations, notifications and announcements.
 *
 * Unread is shown by weight and a marker, never by colour alone — a bold title
 * beside a regular one is legible to somebody who cannot distinguish the tint,
 * and a coloured dot on its own is not.
 */
export function InboxList({ items, selectedId, loading, onSelect }: InboxListProps) {
  if (loading) {
    return (
      <ul className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="bg-surface-raised/40 rounded-control h-16 animate-pulse" />
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-body-sm text-content-secondary rounded-card border-line/50 border border-dashed p-6 text-center text-pretty">
        Nothing in your inbox.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const meta =
          item.itemKind === "notification"
            ? (CATEGORY_META[item.category as keyof typeof CATEGORY_META] ?? {
                label: item.category,
                tone: "neutral" as const,
              })
            : { label: KIND_LABEL[item.itemKind], tone: "neutral" as const };

        return (
          <li key={`${item.itemKind}-${item.id}`}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              aria-current={selectedId === item.id ? "true" : undefined}
              className={cn(
                "focus-ring rounded-control w-full px-3 py-3 text-left transition-colors",
                selectedId === item.id ? "bg-brand/10" : "hover:bg-surface-raised/50"
              )}
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
                <time dateTime={item.at} className="text-caption text-content-muted shrink-0">
                  {timeAgo(item.at)}
                </time>
              </div>

              <p
                className={cn(
                  "text-body-sm mt-1.5 text-pretty",
                  item.unread ? "text-content font-semibold" : "text-content-secondary"
                )}
              >
                {/* A marker as well as the weight, so unread does not depend on
                    noticing a font change. */}
                {item.unread ? (
                  <span className="text-brand mr-1.5" aria-label="Unread">
                    ●
                  </span>
                ) : null}
                {item.title}
              </p>

              {item.body ? (
                <p className="text-caption text-content-muted mt-0.5 line-clamp-2 text-pretty">
                  {item.body}
                </p>
              ) : null}

              {item.messageCount > 0 ? (
                <p className="text-caption text-content-muted mt-1">
                  {item.messageCount} message{item.messageCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
