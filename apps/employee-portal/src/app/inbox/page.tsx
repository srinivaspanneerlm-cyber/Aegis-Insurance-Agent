"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityTimeline,
  InboxList,
  MessageThread,
  type InboxItem,
  type ThreadMessage,
  type TimelineEntry,
} from "@aegis/communication";
import { Empty, Panel, Skeleton } from "@/components/Cards";
import { API_URL } from "@/lib/workspace";

interface ThreadState {
  conversation: { id: string; subject: string | null; kind: string };
  messages: ThreadMessage[];
}

/**
 * The employee inbox.
 *
 * Three panes: what is waiting, the conversation, and what has happened around
 * it. The third pane is the one that makes this different from an email client
 * — an advisor picking up somebody else's case can see the documents, the
 * analysis and the case events beside the conversation, instead of opening four
 * screens to reconstruct it.
 *
 * Internal notes are written from here and are marked as such by the shared
 * component. The server decides what a customer receives; this screen makes
 * sure the person writing knows which of the two they are doing.
 */
export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [thread, setThread] = useState<ThreadState | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [me, setMe] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [inbox, who] = await Promise.all([
        fetch(`${API_URL}/communication/inbox`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API_URL}/auth/me`, { credentials: "include" }).then((r) => r.json()),
      ]);
      setItems(inbox.data?.items ?? []);
      setMe(who.data?.user?.id ?? "");
    } catch {
      setError("Could not load your inbox.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openItem = useCallback(async (item: InboxItem) => {
    setSelected(item);
    setThread(null);
    setSummary(null);
    setTimeline([]);
    if (item.itemKind !== "conversation") return;

    try {
      const [threadRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/communication/conversations/${item.id}`, { credentials: "include" }).then(
          (r) => r.json()
        ),
        fetch(`${API_URL}/communication/conversations/${item.id}/summary`, {
          credentials: "include",
        }).then((r) => r.json()),
      ]);
      setThread(threadRes.data);
      // The assistant reports whether it could help; an unavailable summary
      // shows nothing rather than an empty box.
      if (summaryRes.data?.available) setSummary(summaryRes.data.data.summary);

      const customerId = threadRes.data?.conversation?.customerId;
      if (customerId) {
        const tl = await fetch(
          `${API_URL}/communication/timeline?userId=${encodeURIComponent(customerId)}&take=25`,
          { credentials: "include" }
        ).then((r) => r.json());
        setTimeline(tl.data?.entries ?? []);
      }
    } catch {
      setError("Could not open that conversation.");
    }
  }, []);

  const send = useCallback(
    async (body: string, internal: boolean) => {
      if (!selected) return;
      setSending(true);
      try {
        const res = await fetch(`${API_URL}/communication/conversations/${selected.id}/messages`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, internal }),
        });
        if (!res.ok) throw new Error();
        await openItem(selected);
        await load();
      } catch {
        setError("That message did not send.");
      } finally {
        setSending(false);
      }
    },
    [selected, openItem, load]
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Inbox</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Conversations, notifications and announcements in one place.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <Panel title="Waiting">
          <InboxList
            items={items ?? []}
            loading={items === null}
            selectedId={selected?.id ?? null}
            onSelect={(item) => void openItem(item)}
          />
        </Panel>

        <Panel title={thread?.conversation.subject ?? "Conversation"}>
          {!selected ? (
            <Empty icon="spark">Choose something on the left.</Empty>
          ) : selected.itemKind !== "conversation" ? (
            <div>
              <p className="text-body-sm font-medium text-content">{selected.title}</p>
              {selected.body ? (
                <p className="mt-2 text-pretty text-body-sm text-content-secondary">
                  {selected.body}
                </p>
              ) : null}
            </div>
          ) : thread === null ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="flex h-[34rem] flex-col">
              {summary ? (
                <p className="mb-3 text-pretty rounded-control border border-line/40 bg-surface-raised/30 px-3 py-2 text-caption text-content-secondary">
                  {summary}
                </p>
              ) : null}
              <MessageThread
                messages={thread.messages}
                currentUserId={me}
                canWriteInternal
                sending={sending}
                onSend={(body, internal) => void send(body, internal)}
              />
            </div>
          )}
        </Panel>

        <Panel title="What has happened">
          <ActivityTimeline
            entries={timeline}
            emptyMessage="Open a customer conversation to see their history here."
          />
        </Panel>
      </div>
    </div>
  );
}
