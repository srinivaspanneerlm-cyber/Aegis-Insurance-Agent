"use client";

import { cn } from "@aegis/utils";
import { ProgressTimeline } from "./ProgressTimeline";
import { formatBytes, type UploadItem } from "../lib/types";

export interface UploadCardProps {
  item: UploadItem;
  onRetry?: (item: UploadItem) => void;
  onCancel?: (item: UploadItem) => void;
}

/**
 * A file on its way, from selection to accepted.
 *
 * The progress bar is a real `<progress>` element, because a styled div
 * announces nothing to a screen reader. While the bytes are moving it shows a
 * percentage; once the server takes over it switches to the stage timeline,
 * since a percentage is meaningless for work whose duration nobody knows.
 *
 * A failure always offers retry. Uploads fail for reasons that have nothing to
 * do with the file — a dropped connection on a train — and making somebody
 * re-select the file is a poor answer to a network blip.
 */
export function UploadCard({ item, onRetry, onCancel }: UploadCardProps) {
  const uploading = item.status === "uploading";
  const failed = item.status === "failed";

  return (
    <div className="rounded-card border-line/50 bg-surface-raised/30 border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm text-content truncate font-medium">{item.file.name}</p>
          <p className="text-caption text-content-muted">{formatBytes(item.file.size)}</p>
        </div>
        {onCancel && (uploading || item.status === "queued") ? (
          <button
            type="button"
            onClick={() => onCancel(item)}
            className="focus-ring rounded-control text-caption text-content-secondary hover:text-content shrink-0 px-2 py-1"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {uploading ? (
        <div className="mt-3">
          <progress
            value={item.progress}
            max={100}
            className="h-1.5 w-full"
            aria-label={`Uploading ${item.file.name}`}
          />
          <p className="text-caption text-content-muted mt-1">{item.progress}% sent</p>
        </div>
      ) : null}

      {item.status === "processing" || item.status === "done" ? (
        <div className="mt-3">
          <ProgressTimeline current={item.stage} compact />
        </div>
      ) : null}

      {failed ? (
        <div className="mt-3">
          <p role="alert" className="text-caption text-danger text-pretty">
            {item.error ?? "That did not upload."}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={() => onRetry(item)}
              className={cn(
                "focus-ring rounded-control border-line/60 text-caption text-content hover:border-line mt-2 border px-3 py-1.5 font-medium transition-colors"
              )}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
