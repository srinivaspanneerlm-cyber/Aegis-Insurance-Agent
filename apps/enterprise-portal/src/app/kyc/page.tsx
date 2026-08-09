"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type DocumentsPayload } from "@/lib/api";

const DOC_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  VERIFIED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
  UPLOADED: "neutral",
};

const DOC_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Uploaded",
  PENDING_REVIEW: "Waiting for review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

/**
 * KYC and documents.
 *
 * Two counts that look like one and are not: document verification comes from
 * each document's own status, KYC from the work items that carry the check. A
 * KYC case can span several documents and one document can settle none of them
 * on its own, so they are reported side by side and never added together.
 *
 * The files themselves are not reachable from here. An administrator has a
 * legitimate need to know a check is stuck and none to read somebody's passport.
 */
export default function KycPage() {
  const [data, setData] = useState<DocumentsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .documents()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load documents.");
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

  const pending = data ? (data.byStatus.PENDING_REVIEW ?? 0) + (data.byStatus.UPLOADED ?? 0) : 0;
  const kycOpen = data
    ? Object.entries(data.kycByStatus)
        .filter(([s]) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(s))
        .reduce((a, [, n]) => a + n, 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">KYC &amp; Documents</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Identity checks in flight, and the documents they turn on.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Documents waiting"
              value={pending}
              tone={pending > 0 ? "warning" : "success"}
              icon="book"
            />
            <Stat
              label="Verified"
              value={data.byStatus.VERIFIED ?? 0}
              tone="success"
              icon="check"
            />
            <Stat
              label="Rejected"
              value={data.byStatus.REJECTED ?? 0}
              tone={(data.byStatus.REJECTED ?? 0) > 0 ? "danger" : "neutral"}
              icon="close"
            />
            <Stat
              label="KYC cases open"
              value={kycOpen}
              tone={data.kycOverdue > 0 ? "danger" : "neutral"}
              icon="users"
              {...(data.kycOverdue > 0 ? { hint: `${data.kycOverdue} past their due time` } : {})}
            />
          </div>

          {/* Said explicitly. The two figures measure different things and
              somebody reading them as one total would be wrong. */}
          <p className="text-pretty text-caption text-content-muted">
            Document counts and KYC case counts measure different things — a case can span several
            documents — so they are not added together. {data.automatedVerification.reason}
          </p>

          {data.unowned > 0 ? (
            <div className="rounded-card border border-warning/40 bg-warning/10 px-4 py-3">
              <p className="text-body-sm font-medium text-content">
                {data.unowned} document{data.unowned === 1 ? " has" : "s have"} no owner.
              </p>
              <p className="mt-0.5 text-caption text-content-secondary">
                Their uploader's account was removed. Nobody can be asked about them and no check
                can be completed against them.
              </p>
            </div>
          ) : null}

          <Panel title="Most recent documents">
            {data.recent.length === 0 ? (
              <Empty icon="book">No documents have been uploaded yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Document
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Customer
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Status
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Uploaded
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((d) => (
                      <tr key={d.id} className="border-b border-line/30 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="break-words text-body-sm text-content">{d.filename}</p>
                          <p className="text-caption text-content-muted">
                            {d.documentKey?.replace(/_/g, " ") ?? d.domain ?? "unclassified"}
                          </p>
                          {/* The reason is the sentence telling somebody what to
                              fix, so it wraps rather than truncating. */}
                          {d.rejectionReason ? (
                            <p className="mt-1 text-pretty break-words text-caption text-danger">
                              {d.rejectionReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          {d.owner ? (
                            <Link
                              href={`/customers/${d.owner.id}`}
                              className="focus-ring rounded text-body-sm text-brand"
                            >
                              {d.owner.name}
                            </Link>
                          ) : (
                            <span className="text-caption text-content-muted">no owner</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={DOC_STATUS_TONE[d.status] ?? "neutral"}>
                            {DOC_STATUS_LABELS[d.status] ?? d.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-caption tabular-nums text-content-muted">
                          {new Date(d.uploadedAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <p className="text-pretty text-caption text-content-muted">
            The files themselves are not reachable from this console. Reviewing a document is done
            by the people answerable for the decision.
          </p>
        </>
      )}
    </div>
  );
}
