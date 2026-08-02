"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudUpload, FileText, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import { ACCEPT_ANY, MAX_UPLOAD_BYTES } from "@/lib/documents/registry";
import {
  acceptAttribute,
  describeAccept,
  formatBytes,
  validateFile,
  type FileRejection,
} from "@/lib/documents/validation";
import type { DocumentLocale, DocumentRequirement } from "@/types/documents";

interface UploadModalProps {
  open: boolean;
  /** Opened from an upload card — its accept set and limits win. */
  requirement?: DocumentRequirement;
  /** Opened from the attachment menu — an ad-hoc picker configuration. */
  accept?: string[];
  maxBytes?: number;
  multiple?: boolean;
  capture?: "environment" | "user";
  /** Heading. Defaults to the requirement's name, or a generic prompt. */
  title?: string;
  locale?: DocumentLocale;
  /** Jump straight to the native picker on open — used for the camera source,
   *  where an intermediate screen only gets in the way. */
  autoOpenPicker?: boolean;
  onClose: () => void;
  onConfirm: (files: File[]) => void;
}

interface StagedFile {
  file: File;
  rejection: FileRejection | null;
}

const stagedKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

/**
 * The picker surface: drag a file in, or browse for one.
 *
 * It exists instead of a bare `<input type="file">` because a native picker
 * cannot drag-and-drop, cannot show *why* a file was turned away, and cannot
 * let someone reconsider before the upload starts. Everything it reports is a
 * courtesy check — the server re-validates every byte (see `validation.ts`).
 */
export function UploadModal({
  open,
  requirement,
  accept,
  maxBytes,
  multiple,
  capture,
  title,
  locale = "en",
  autoOpenPicker = false,
  onClose,
  onConfirm,
}: UploadModalProps) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const dragDepth = useRef(0);

  const acceptList = requirement?.accept ?? accept ?? ACCEPT_ANY;
  const limit = Math.min(requirement?.maxBytes ?? maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  const allowMany = requirement?.multiple ?? multiple ?? false;
  const heading =
    title ?? (requirement ? localise(requirement.label, locale) : "Attach a file");

  const accepted = staged.filter((s) => s.rejection === null);

  // Reset between openings — a modal that remembers the last attempt's
  // rejections is confusing the second time round.
  useEffect(() => {
    if (open) {
      setStaged([]);
      setDragging(false);
      dragDepth.current = 0;
    }
  }, [open]);

  // Focus into the dialog on open, back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      if (autoOpenPicker) inputRef.current?.click();
      else closeRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, autoOpenPicker]);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;
      const chosen = allowMany ? incoming : incoming.slice(0, 1);
      const validated = chosen.map((file) => ({
        file,
        rejection: validateFile(file, { accept: acceptList, maxBytes: limit, label: { en: heading } }),
      }));

      setStaged((prev) => {
        if (!allowMany) return validated;
        const seen = new Set(prev.map((s) => stagedKey(s.file)));
        return [...prev, ...validated.filter((v) => !seen.has(stagedKey(v.file)))];
      });
    },
    [allowMany, acceptList, limit, heading],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // dragenter/dragleave fire for every child element, so the highlight is
  // driven by a depth counter rather than the raw events.
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(Array.from(e.dataTransfer?.files ?? []));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-5 backdrop-blur-md"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className={cn(
              "w-full max-w-lg overflow-hidden rounded-3xl border border-white/10",
              "bg-slate-900/80 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
            )}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start gap-3 border-b border-white/5 px-6 py-5">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-lg">
                {requirement?.icon ?? <CloudUpload className="h-4 w-4 text-slate-300" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-[15px] font-black tracking-tight text-white">
                  {heading}
                </h2>
                <p id={descId} className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {describeAccept(acceptList, limit)}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* ── Drop zone ──────────────────────────────────────────────── */}
            <div className="px-6 py-5">
              <div
                data-testid="dropzone"
                onDragEnter={onDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  "rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all",
                  dragging
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-white/12 bg-white/[0.02]",
                )}
              >
                <motion.span
                  animate={dragging ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5"
                >
                  <CloudUpload className={cn("h-5 w-5", dragging ? "text-cyan-300" : "text-slate-400")} aria-hidden />
                </motion.span>

                <p className="text-[12px] font-bold text-slate-200">
                  {dragging ? "Drop to attach" : "Drag your file here"}
                </p>
                <p className="mt-1 text-[10.5px] font-medium text-slate-500">
                  {allowMany ? "One or more files" : "One file"} · max {formatBytes(limit)}
                </p>

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-4 rounded-xl border border-white/12 bg-white/5 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                  Browse files
                </button>

                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={acceptAttribute(acceptList)}
                  multiple={allowMany}
                  capture={capture}
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = ""; // re-picking the same file must still fire
                  }}
                />
              </div>

              {/* ── Staged files ─────────────────────────────────────────── */}
              {staged.length > 0 && (
                <ul className="mt-4 space-y-2" aria-label="Selected files">
                  {staged.map((item) => (
                    <motion.li
                      key={stagedKey(item.file)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
                        item.rejection
                          ? "border-rose-400/25 bg-rose-500/[0.07]"
                          : "border-white/8 bg-white/[0.03]",
                      )}
                    >
                      {item.rejection ? (
                        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-rose-300" aria-hidden />
                      ) : (
                        <FileText className="mt-px h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-bold text-slate-200">{item.file.name}</p>
                        <p
                          className={cn(
                            "mt-0.5 text-[10px] font-medium",
                            item.rejection ? "text-rose-300" : "text-slate-500",
                          )}
                        >
                          {item.rejection
                            ? localise(item.rejection.message, locale)
                            : formatBytes(item.file.size)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setStaged((prev) => prev.filter((s) => stagedKey(s.file) !== stagedKey(item.file)))
                        }
                        aria-label={`Remove ${item.file.name}`}
                        className="flex-shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2.5 border-t border-white/5 bg-slate-950/40 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={accepted.length === 0}
                onClick={() => {
                  onConfirm(accepted.map((s) => s.file));
                  onClose();
                }}
                className={cn(
                  "rounded-xl border border-white/10 bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-950",
                  "transition-all hover:bg-slate-100 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                {accepted.length > 1 ? `Upload ${accepted.length} files` : "Upload"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
