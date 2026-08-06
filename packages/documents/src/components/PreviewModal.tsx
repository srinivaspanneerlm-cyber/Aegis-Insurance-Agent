"use client";

import { useEffect, useRef } from "react";
import { cn } from "@aegis/utils";
import { previewKindFor, formatBytes, type DocumentSummary } from "../lib/types";

export interface PreviewModalProps {
  document: DocumentSummary | null;
  /** Where the bytes can be fetched. The app supplies it; this never builds one. */
  src: string | null;
  onClose: () => void;
}

/**
 * Full-screen preview for images, PDFs and video.
 *
 * A real dialog: focus moves in on open and returns on close, Escape closes it,
 * and the background is inert. A "modal" that leaves focus behind it is a trap
 * for keyboard users — they tab into a page they cannot see.
 *
 * Formats with no in-browser renderer say so rather than showing an empty
 * frame, because a blank preview reads as a broken document.
 */
export function PreviewModal({ document: doc, src, onClose }: PreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!doc) return;
    returnFocusTo.current = window.document.activeElement;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.document.addEventListener("keydown", onKey);
    return () => {
      window.document.removeEventListener("keydown", onKey);
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [doc, onClose]);

  if (!doc) return null;
  const kind = previewKindFor(doc.mimeType);

  return (
    <div
      className="z-modal bg-overlay/80 fixed inset-0 flex flex-col p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${doc.filename}`}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body text-content truncate font-medium">{doc.filename}</p>
          <p className="text-caption text-content-muted">
            {doc.mimeType ?? "unknown type"}
            {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="focus-ring rounded-control border-line bg-surface text-body-sm text-content hover:border-line-strong shrink-0 border px-4 py-2 font-medium transition-colors"
        >
          Close
        </button>
      </header>

      <div
        className={cn(
          "flex flex-1 items-center justify-center overflow-auto",
          "rounded-card bg-surface/40"
        )}
      >
        {!src ? (
          <p className="text-body-sm text-content-secondary p-8 text-center">
            The file could not be loaded.
          </p>
        ) : kind === "image" ? (
          // A plain <img>, deliberately. The source is a blob or a signed
          // preview URL, which an image optimiser cannot process — and this
          // package is framework-agnostic, so it must not reach for one.
          <img src={src} alt={doc.filename} className="max-h-full max-w-full object-contain" />
        ) : kind === "pdf" ? (
          <iframe src={src} title={`Preview of ${doc.filename}`} className="h-full w-full" />
        ) : kind === "video" ? (
          <video src={src} controls className="max-h-full max-w-full" />
        ) : (
          <div className="p-8 text-center">
            <p className="text-body text-content">No preview for this format</p>
            <p className="text-body-sm text-content-secondary mt-2 max-w-sm text-pretty">
              We hold the file safely — a browser simply cannot display{" "}
              {doc.mimeType ?? "this type"} without converting it first. Download it to open it.
            </p>
            <a
              href={src}
              download={doc.filename}
              className="focus-ring rounded-control bg-brand text-brand-fg hover:bg-brand-hover text-body-sm mt-5 inline-block px-5 py-2.5 font-semibold transition-colors"
            >
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
