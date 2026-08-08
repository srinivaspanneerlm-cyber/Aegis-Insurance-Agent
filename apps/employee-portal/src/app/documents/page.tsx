"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DocumentCard,
  PreviewModal,
  ProgressTimeline,
  type DocumentSummary,
  type DocumentTimelineEvent,
  type PipelineStageKey,
} from "@aegis/documents";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { API_URL } from "@/lib/workspace";
import { workspaceApi } from "@/lib/api";

interface QueueResponse {
  waiting: number;
  documents: (DocumentSummary & { owner: { id: string; name: string; email: string } | null })[];
}

/**
 * The document verification queue.
 *
 * Every card, badge and timeline here comes from `@aegis/documents` — the same
 * components the customer sees their own documents through. That is the point
 * of the shared package: an employee and a customer looking at the same
 * document see the same status wording, so a phone call about it is a
 * conversation rather than a translation.
 *
 * What differs is the authority, and that lives entirely on the server. This
 * screen can offer a decision; whether it is accepted is the API's answer.
 */
export default function DocumentQueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentSummary | null>(null);
  const [timeline, setTimeline] = useState<Record<string, DocumentTimelineEvent[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      // Through the client rather than a raw fetch: one place handles the
      // session cookie and the error envelope, and a caller cannot forget
      // either. The dashboard reads the same method.
      setData((await workspaceApi.documentQueue()) as unknown as QueueResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Fetch a document's history the first time somebody opens it. */
  const loadTimeline = useCallback(
    async (id: string) => {
      if (timeline[id]) return;
      try {
        const response = await fetch(`${API_URL}/documents/${id}`, { credentials: "include" });
        const body = await response.json();
        if (response.ok) {
          setTimeline((current) => ({ ...current, [id]: body.data.events }));
        }
      } catch {
        /* the card is still usable without its history */
      }
    },
    [timeline]
  );

  const decide = useCallback(
    async (id: string, decision: "VERIFY" | "REJECT", why?: string) => {
      setBusy(id);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/documents/${id}/decision`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason: why }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "That did not go through.");
        setRejecting(null);
        setReason("");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Document Verification</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Oldest first. A rejection needs a reason — the customer is shown it.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Waiting"
            value={data.waiting}
            icon="clock"
            tone={data.waiting > 20 ? "warning" : "neutral"}
          />
          <Stat label="Shown" value={data.documents.length} icon="layers" />
          <Stat
            label="Oldest"
            value={
              data.documents[0]
                ? new Date(data.documents[0].uploadedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })
                : "—"
            }
            icon="chart"
          />
        </div>
      ) : null}

      <Panel title={data ? `${data.documents.length} awaiting review` : "Loading"}>
        {data === null && !error ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : data && data.documents.length === 0 ? (
          <Empty icon="check">Nothing is waiting. The queue is clear.</Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {data?.documents.map((document) => (
              <li key={document.id}>
                <DocumentCard document={document} onPreview={(d) => setPreview(d)}>
                  <div className="flex flex-col gap-3">
                    {document.owner ? (
                      <p className="text-caption text-content-muted">
                        From {document.owner.name} · {document.owner.email}
                      </p>
                    ) : null}

                    <details onToggle={() => void loadTimeline(document.id)}>
                      <summary className="focus-ring cursor-pointer list-none rounded text-caption font-medium text-brand">
                        Show history
                      </summary>
                      <div className="mt-3">
                        {timeline[document.id] ? (
                          <ProgressTimeline
                            current={
                              (timeline[document.id]!.at(-1)?.stage as PipelineStageKey) ?? null
                            }
                          />
                        ) : (
                          <Skeleton className="h-20 w-full" />
                        )}
                      </div>
                    </details>

                    {rejecting === document.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void decide(document.id, "REJECT", reason);
                        }}
                        className="flex flex-col gap-2"
                      >
                        <label
                          htmlFor={`reason-${document.id}`}
                          className="text-caption text-content"
                        >
                          Why can this not be used? The customer sees this.
                        </label>
                        <input
                          id={`reason-${document.id}`}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          required
                          placeholder="The registration number is not legible — please re-photograph it."
                          className="h-10 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={busy === document.id}
                            className="focus-ring rounded-control bg-danger px-4 py-2 text-caption font-semibold text-status-fg transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejecting(null);
                              setReason("");
                            }}
                            className="focus-ring rounded-control border border-line px-4 py-2 text-caption font-medium text-content"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy === document.id}
                          onClick={() => void decide(document.id, "VERIFY")}
                          className="focus-ring rounded-control bg-brand px-4 py-2 text-caption font-semibold text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-50"
                        >
                          {busy === document.id ? "Saving…" : "Verify"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(document.id)}
                          className="focus-ring rounded-control border border-line/60 px-4 py-2 text-caption font-medium text-content-secondary transition-colors hover:border-danger hover:text-danger"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </DocumentCard>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <PreviewModal
        document={preview}
        // The bytes are served by the API behind the same session cookie, so
        // this portal never holds a signed URL of its own.
        src={preview ? `${API_URL}/upload/${preview.id}/raw` : null}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
