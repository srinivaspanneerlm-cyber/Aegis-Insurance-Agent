"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@aegis/utils";
import { timeAgo, type ThreadMessage } from "../lib/types";

export interface MessageThreadProps {
  messages: ThreadMessage[];
  currentUserId: string;
  subject?: string | null;
  /** Whether this reader may write internal notes. Staff only. */
  canWriteInternal?: boolean;
  sending?: boolean;
  onSend: (body: string, internal: boolean) => void;
  /** A draft the assistant proposed, for a person to edit and send. */
  suggestion?: string | null;
}

/**
 * A conversation.
 *
 * Internal notes are visibly different — a distinct background, a border, and
 * the word "Internal" in text. Three signals rather than one, because an
 * advisor who mistakes an internal note for a customer reply will eventually
 * write something the customer should never read. The server already prevents
 * a customer from *receiving* one; this prevents staff from *misreading* one.
 *
 * The composer is a form so Enter behaves as people expect and the keyboard
 * works without a mouse.
 */
export function MessageThread({
  messages,
  currentUserId,
  subject,
  canWriteInternal,
  sending,
  onSend,
  suggestion,
}: MessageThreadProps) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col">
      {subject ? (
        <h2 className="text-body text-content border-line/40 border-b px-1 pb-3 font-semibold">
          {subject}
        </h2>
      ) : null}

      <ol className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          const isAi = message.senderKind === "AI";

          return (
            <li
              key={message.id}
              className={cn(
                "rounded-card max-w-[85%] border p-3",
                message.internal
                  ? "border-warning/40 bg-warning/5"
                  : mine
                    ? "border-brand/30 bg-brand/5 self-end"
                    : "border-line/50 bg-surface-raised/30"
              )}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-caption text-content font-medium">{message.senderName}</span>
                {isAi ? (
                  <span className="rounded-pill border-success/40 text-success border px-1.5 text-[0.625rem] font-semibold">
                    Aegis
                  </span>
                ) : null}
                {message.internal ? (
                  // In words, not only in colour.
                  <span className="rounded-pill border-warning/50 text-warning border px-1.5 text-[0.625rem] font-semibold uppercase">
                    Internal — not visible to the customer
                  </span>
                ) : null}
                <time dateTime={message.createdAt} className="text-caption text-content-muted">
                  {timeAgo(message.createdAt)}
                </time>
              </div>

              <p className="text-body-sm text-content mt-1.5 text-pretty whitespace-pre-wrap">
                {message.body}
              </p>

              {message.attachmentIds.length > 0 ? (
                <p className="text-caption text-content-muted mt-1.5">
                  {message.attachmentIds.length} attachment
                  {message.attachmentIds.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!body.trim()) return;
          onSend(body.trim(), internal);
          setBody("");
          setInternal(false);
        }}
        className="border-line/40 flex flex-col gap-2 border-t pt-3"
      >
        {suggestion ? (
          <div className="rounded-control border-success/30 bg-success/5 border p-2.5">
            <p className="text-caption text-content-secondary text-pretty">
              Aegis suggested a reply. Nothing is sent until you send it.
            </p>
            <button
              type="button"
              onClick={() => setBody(suggestion)}
              className="focus-ring rounded-control text-caption text-brand mt-1 font-medium"
            >
              Use this draft
            </button>
          </div>
        ) : null}

        <label htmlFor="composer" className="sr-only">
          Write a message
        </label>
        <textarea
          id="composer"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder={internal ? "A note for colleagues only…" : "Write a reply…"}
          className="rounded-control border-line/60 bg-surface-raised/40 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:ring-brand/40 w-full resize-y border px-3 py-2 focus:ring-2 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="focus-ring rounded-control bg-brand text-brand-fg hover:bg-brand-hover text-caption px-4 py-2 font-semibold transition-colors disabled:opacity-50"
          >
            {sending ? "Sending…" : internal ? "Add internal note" : "Send"}
          </button>

          {canWriteInternal ? (
            <span className="flex items-center gap-2">
              <input
                id="internal"
                type="checkbox"
                checked={internal}
                onChange={(event) => setInternal(event.target.checked)}
                className="focus-ring border-line/60 h-4 w-4 rounded"
              />
              <label htmlFor="internal" className="text-caption text-content-secondary">
                Internal note — the customer will not see this
              </label>
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
