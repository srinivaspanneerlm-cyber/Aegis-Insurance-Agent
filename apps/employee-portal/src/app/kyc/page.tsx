"use client";

import { useEffect, useState } from "react";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { QueuePage } from "@/components/QueuePage";
import { workspaceApi } from "@/lib/api";

const KINDS = ["KYC"];

/** The identity documents a KYC check actually turns on. */
const IDENTITY_KEYS = new Set(["id_proof", "address_proof", "pan_card", "aadhaar"]);

interface QueuedDocument {
  id: string;
  filename: string;
  documentKey: string | null;
  status: string;
  uploadedAt: string;
  owner: { id: string; name: string; email: string } | null;
}

/**
 * KYC review.
 *
 * The queue below lists KYC work items — the cases. The panel above lists the
 * identity documents actually waiting on a person, which is what a check turns
 * on: a KYC case with no document to look at is a case nobody can progress, and
 * a queue of case titles does not show the difference.
 *
 * Both come from endpoints that already exist. The identity filter is applied
 * here because the document queue serves every kind of verification, and only
 * the identity ones belong on this screen.
 */
export default function KycPage() {
  const [documents, setDocuments] = useState<QueuedDocument[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .documentQueue()
      .then((data) => {
        if (cancelled) return;
        const all = data.documents as unknown as QueuedDocument[];
        setDocuments(all.filter((d) => d.documentKey && IDENTITY_KEYS.has(d.documentKey)));
      })
      .catch(() => {
        // The case queue below still works; a failed document list must not
        // take the page with it.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Panel title="Identity documents waiting">
        {failed ? (
          <p className="text-body-sm text-content-secondary">
            The document queue could not be loaded. Your assigned cases are below.
          </p>
        ) : documents === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <Empty icon="check">
            No identity documents are waiting. Cases below may still need other checks.
          </Empty>
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Stat
                label="Waiting on a person"
                value={documents.length}
                tone={documents.length > 0 ? "warning" : "neutral"}
                icon="shield"
              />
              <Stat
                label="Oldest"
                value={
                  documents[0]
                    ? new Date(documents[0].uploadedAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"
                }
                icon="clock"
              />
            </div>

            <ul className="flex flex-col gap-2">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-control border border-line/50 bg-surface-raised/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-content">
                      {/* Whose document, named. A filename alone does not tell a
                          reviewer which customer they are deciding about. */}
                      {document.owner?.name ?? "Unknown customer"}
                    </p>
                    <p className="break-words text-caption text-content-muted">
                      {document.filename} · {document.documentKey?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <a
                    href="/documents"
                    className="focus-ring shrink-0 rounded text-caption font-medium text-brand"
                  >
                    Review in verification
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <QueuePage
        title="KYC Verification"
        description="Identity checks assigned to you. The documents above are what those checks turn on."
        kinds={KINDS}
        emptyMessage="No KYC checks are assigned to you."
      />
    </div>
  );
}
