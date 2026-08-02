"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FlaskConical,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import { formatBytes } from "@/lib/documents/validation";
import { getKind } from "@/lib/documents/registry";
import type { DocumentLocale, DocumentUpload } from "@/types/documents";
import { UploadProgress } from "./UploadProgress";
import { VerificationStatus } from "./VerificationStatus";
import {
  isSimulated,
  passedBadges,
  phaseMeta,
  pipelineProgress,
  unverifiedCount,
  type StatusTone,
} from "./statusMeta";

interface DocumentCardProps {
  upload: DocumentUpload;
  locale?: DocumentLocale;
  /** Start expanded — used when a card is the only thing on screen. */
  defaultExpanded?: boolean;
  /** Each action renders only when its handler is supplied, so the card never
   *  shows a button that does nothing. */
  onView?: (upload: DocumentUpload) => void;
  onReplace?: (upload: DocumentUpload) => void;
  onDelete?: (upload: DocumentUpload) => void;
  onDownload?: (upload: DocumentUpload) => void;
  onRetry?: (upload: DocumentUpload) => void;
  className?: string;
}

const PILL_TONE: Record<StatusTone, string> = {
  neutral: "border-white/10 bg-white/5 text-slate-300",
  info: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  danger: "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

const ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 " +
  "text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors " +
  "hover:border-white/15 hover:bg-white/8 hover:text-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60";

/**
 * An uploaded document as an intelligent card: what it is, how far it got
 * through verification, what the pipeline read out of it, and what the customer
 * can do with it.
 *
 * The badge row is the honest part — a check that was skipped because no
 * service is connected is counted separately rather than quietly omitted, and a
 * simulated run is labelled as one.
 */
export function DocumentCard({
  upload,
  locale = "en",
  defaultExpanded = false,
  onView,
  onReplace,
  onDelete,
  onDownload,
  onRetry,
  className,
}: DocumentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  const spec = getKind(upload.kind);
  const meta = phaseMeta(upload);
  const badges = passedBadges(upload.stages);
  const unchecked = unverifiedCount(upload.stages);
  const simulated = isSimulated(upload);
  const inFlight = upload.phase === "uploading" || upload.phase === "verifying";
  const fields = Object.entries(upload.intelligence?.fields ?? {});

  const progress =
    upload.phase === "uploading" ? upload.progress : pipelineProgress(upload.stages);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-2xl border border-white/8 bg-slate-950/50 p-3.5 backdrop-blur-sm",
        upload.phase === "failed" && "border-rose-500/25 bg-rose-950/15",
        className,
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-base"
          aria-hidden
        >
          {spec?.icon ?? <FileText className="h-4 w-4 text-slate-400" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-slate-100">{upload.file.name}</p>
          <p className="mt-0.5 text-[10px] font-medium text-slate-500">
            {formatBytes(upload.file.sizeBytes)}
            {upload.uploadedAt && ` · ${upload.uploadedAt}`}
          </p>
        </div>

        <span
          className={cn(
            "flex-shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
            PILL_TONE[meta.tone],
          )}
        >
          {localise(meta.label, locale)}
        </span>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? `Collapse ${upload.file.name}` : `Expand ${upload.file.name}`}
          className="flex-shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18 }} className="block">
            <ChevronDown className="h-4 w-4" aria-hidden />
          </motion.span>
        </button>
      </div>

      {/* ── Live progress ──────────────────────────────────────────────────── */}
      {inFlight && (
        <UploadProgress
          className="mt-3"
          value={progress}
          label={`${upload.phase === "uploading" ? "Uploading" : "Verifying"} ${upload.file.name}`}
          caption={`${progress}%`}
        />
      )}

      {/* ── Failure ────────────────────────────────────────────────────────── */}
      {upload.phase === "failed" && upload.error && (
        <p className="mt-3 flex items-start gap-2 text-[11px] font-semibold text-rose-300">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          {upload.error}
        </p>
      )}

      {/* ── Badge row ──────────────────────────────────────────────────────── */}
      {(badges.length > 0 || simulated || unchecked > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.id}
              className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300"
            >
              {localise(badge.label, locale)}
            </span>
          ))}

          {simulated && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              <FlaskConical className="h-2.5 w-2.5" aria-hidden />
              Simulated
            </span>
          )}

          {unchecked > 0 && !inFlight && (
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {unchecked} check{unchecked > 1 ? "s" : ""} not run
            </span>
          )}
        </div>
      )}

      {/* ── Detail panel ───────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
              <VerificationStatus stages={upload.stages} locale={locale} />

              {fields.length > 0 && (
                <dl className="grid grid-cols-2 gap-2">
                  {fields.map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2">
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                      <dd className="mt-0.5 truncate text-[11px] font-semibold text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {upload.intelligence?.flags
                .filter((f) => f !== "Simulated")
                .map((flag) => (
                  <p key={flag} className="text-[10px] font-medium text-amber-300/80">
                    ⚠ {flag}
                  </p>
                ))}

              <div className="flex flex-wrap gap-1.5">
                {onView && (
                  <button type="button" className={ACTION} onClick={() => onView(upload)}>
                    <Eye className="h-3 w-3" aria-hidden /> View
                  </button>
                )}
                {onDownload && (
                  <button type="button" className={ACTION} onClick={() => onDownload(upload)}>
                    <Download className="h-3 w-3" aria-hidden /> Download
                  </button>
                )}
                {onReplace && (
                  <button type="button" className={ACTION} onClick={() => onReplace(upload)}>
                    <Upload className="h-3 w-3" aria-hidden /> Replace
                  </button>
                )}
                {onRetry && upload.phase === "failed" && (
                  <button type="button" className={ACTION} onClick={() => onRetry(upload)}>
                    <RefreshCw className="h-3 w-3" aria-hidden /> Retry
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className={cn(ACTION, "hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300")}
                    onClick={() => onDelete(upload)}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden /> Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
