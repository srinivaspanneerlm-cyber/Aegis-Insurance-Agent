"use client";

import { motion } from "framer-motion";
import { Check, CloudUpload, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import { describeAccept } from "@/lib/documents/validation";
import type { DocumentLocale, DocumentRequirement, DocumentUpload } from "@/types/documents";
import { DocumentCard } from "./DocumentCard";
import { requirementState, type RequirementState } from "./statusMeta";

interface UploadCardProps {
  requirement: DocumentRequirement;
  /** Files already attached to this requirement. */
  uploads?: DocumentUpload[];
  locale?: DocumentLocale;
  disabled?: boolean;
  /** Open the picker for this requirement. */
  onPick: (requirement: DocumentRequirement) => void;
  onView?: (upload: DocumentUpload) => void;
  onReplace?: (upload: DocumentUpload) => void;
  onDelete?: (upload: DocumentUpload) => void;
  onRetry?: (upload: DocumentUpload) => void;
  className?: string;
}

const STATE_PILL: Record<RequirementState, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-white/10 bg-white/5 text-slate-400" },
  active: { label: "In progress", className: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300" },
  complete: { label: "Received", className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" },
  failed: { label: "Failed", className: "border-rose-400/30 bg-rose-500/10 text-rose-300" },
};

/**
 * One document the agent asked for, as an interactive card inside the chat.
 *
 * The card owns no upload logic — it renders the requirement, delegates the
 * picker to its parent, and shows a {@link DocumentCard} for every file already
 * attached. That keeps it usable anywhere a requirement appears: the transcript,
 * the workflow accordion, or a standalone checklist.
 */
export function UploadCard({
  requirement,
  uploads = [],
  locale = "en",
  disabled = false,
  onPick,
  onView,
  onReplace,
  onDelete,
  onRetry,
  className,
}: UploadCardProps) {
  const state = requirementState(uploads);
  const pill = STATE_PILL[state];
  const label = localise(requirement.label, locale);
  const canAddMore = requirement.multiple || uploads.length === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        state === "complete"
          ? "border-emerald-400/20 bg-emerald-950/10"
          : "border-white/8 bg-white/[0.02]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-lg"
          aria-hidden
        >
          {requirement.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[13px] font-bold text-slate-100">{label}</h4>
            {!requirement.required && (
              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                Optional
              </span>
            )}
          </div>

          {requirement.hint && (
            <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-400">
              {localise(requirement.hint, locale)}
            </p>
          )}

          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">
            {describeAccept(requirement.accept, requirement.maxBytes)}
          </p>
        </div>

        <span
          className={cn(
            "flex-shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
            pill.className,
          )}
        >
          {state === "active" && <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" aria-hidden />}
          {state === "complete" && <Check className="mr-1 inline h-2.5 w-2.5 stroke-[3]" aria-hidden />}
          {pill.label}
        </span>
      </div>

      {/* Attached files */}
      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((upload) => (
            <DocumentCard
              key={upload.id}
              upload={upload}
              locale={locale}
              onView={onView}
              onReplace={onReplace}
              onDelete={onDelete}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}

      {canAddMore && (
        <button
          type="button"
          onClick={() => onPick(requirement)}
          disabled={disabled}
          aria-label={`${uploads.length > 0 ? "Add another file for" : "Upload"} ${label}`}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5",
            "text-[11px] font-bold uppercase tracking-wider transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "border-white/12 bg-white/[0.02] text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-500/[0.06] hover:text-cyan-200",
            "active:scale-[0.99]",
          )}
        >
          <CloudUpload className="h-3.5 w-3.5" aria-hidden />
          {uploads.length > 0 ? "Add another" : `Upload ${label}`}
        </button>
      )}
    </motion.div>
  );
}
