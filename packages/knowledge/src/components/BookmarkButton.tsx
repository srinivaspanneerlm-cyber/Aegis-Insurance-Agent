"use client";

import { cn } from "@aegis/utils";

export interface BookmarkButtonProps {
  id: string;
  title: string;
  bookmarked: boolean;
  onToggle: (id: string) => void;
  /** Where bookmarks live. "device" is the honest default — see useBookmarks. */
  persistence?: "device" | "account";
}

/**
 * Saves an article for later.
 *
 * The label says what will happen and names the article, because a page of
 * fifteen buttons all called "Bookmark" is unusable with a screen reader.
 * `aria-pressed` carries the state, so it is announced rather than only drawn.
 *
 * The tooltip says bookmarks are saved on this device. Phase A has no bookmark
 * endpoint, and implying a sync that does not happen is how somebody loses a
 * reading list they thought was safe.
 */
export function BookmarkButton({
  id,
  title,
  bookmarked,
  onToggle,
  persistence = "device",
}: BookmarkButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? `Remove bookmark from ${title}` : `Bookmark ${title}`}
      title={
        persistence === "device"
          ? "Saved on this device only — bookmarks do not follow you to another browser."
          : undefined
      }
      className={cn(
        "focus-ring rounded-control text-body-sm shrink-0 px-2 py-1 transition-colors",
        bookmarked ? "text-warning" : "text-content-muted hover:text-content"
      )}
    >
      <span aria-hidden="true">{bookmarked ? "★" : "☆"}</span>
    </button>
  );
}
