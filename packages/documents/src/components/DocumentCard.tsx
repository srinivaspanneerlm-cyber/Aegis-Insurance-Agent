"use client";

import { cn } from "@aegis/utils";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { formatBytes, previewKindFor, type DocumentSummary } from "../lib/types";

export interface DocumentCardProps {
  document: DocumentSummary;
  onPreview?: (document: DocumentSummary) => void;
  onReplace?: (document: DocumentSummary) => void;
  onDelete?: (document: DocumentSummary) => void;
  /** Rendered under the card — the timeline, when a detail view wants it. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * One document, everywhere it appears.
 *
 * The rejection reason is rendered prominently rather than tucked into a
 * tooltip, because it is the only actionable thing on a rejected card — a
 * customer who cannot see why will send the same file again.
 *
 * Actions are real buttons with visible labels, not icon-only controls. This
 * platform serves people who are not confident with software, and a row of
 * unlabelled glyphs is where they stop.
 */
export function DocumentCard({
  document,
  onPreview,
  onReplace,
  onDelete,
  children,
  className,
}: DocumentCardProps) {
  const previewable = previewKindFor(document.mimeType) !== "none";

  return (
    <article
      className={cn(
        "rounded-card border-line/50 bg-surface-raised/30 flex flex-col border p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body-sm text-content truncate font-medium">{document.filename}</h3>
          <p className="text-caption text-content-muted mt-0.5">
            {document.mimeType ?? "unknown type"}
            {document.sizeBytes ? ` · ${formatBytes(document.sizeBytes)}` : ""}
            {" · "}
            {new Date(document.uploadedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <DocumentStatusBadge status={document.status} />
      </div>

      {document.status === "REJECTED" && document.rejectionReason ? (
        <p className="rounded-control bg-danger/10 text-caption text-danger mt-3 px-3 py-2 text-pretty">
          {document.rejectionReason}
        </p>
      ) : null}

      {document.riskScore !== null && document.riskReason ? (
        <p className="text-caption text-content-muted mt-3 text-pretty">
          Risk review: {document.riskReason}
        </p>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}

      {onPreview || onReplace || onDelete ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onPreview ? (
            <button
              type="button"
              onClick={() => onPreview(document)}
              disabled={!previewable}
              className="focus-ring rounded-control border-line/60 text-caption text-content hover:border-line border px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
              title={previewable ? undefined : "This format cannot be previewed in a browser"}
            >
              Preview
            </button>
          ) : null}
          {onReplace ? (
            <button
              type="button"
              onClick={() => onReplace(document)}
              className="focus-ring rounded-control border-line/60 text-caption text-content hover:border-line border px-3 py-1.5 font-medium transition-colors"
            >
              Replace
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(document)}
              className="focus-ring rounded-control border-line/60 text-caption text-content-secondary hover:border-danger hover:text-danger border px-3 py-1.5 font-medium transition-colors"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
