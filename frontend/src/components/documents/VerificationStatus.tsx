"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Link2,
  Loader2,
  MapPin,
  ScanText,
  ShieldCheck,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import type {
  DocumentLocale,
  VerificationStage,
  VerificationStageId,
} from "@/types/documents";
import { STAGE_PASSED_BADGE, STAGE_RUNNING_LABEL, STATUS_TONE, type StatusTone } from "./statusMeta";

interface VerificationStatusProps {
  stages: VerificationStage[];
  locale?: DocumentLocale;
  className?: string;
}

const STAGE_ICON: Record<VerificationStageId, LucideIcon> = {
  upload: Upload,
  ocr: ScanText,
  metadata: CircleDashed,
  gps: MapPin,
  fraud: ShieldCheck,
  blockchain: Link2,
};

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-slate-500",
  info: "text-cyan-300",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-rose-300",
};

const TONE_RING: Record<StatusTone, string> = {
  neutral: "border-white/8 bg-white/[0.03]",
  info: "border-cyan-400/30 bg-cyan-500/10",
  success: "border-emerald-400/30 bg-emerald-500/10",
  warning: "border-amber-400/30 bg-amber-500/10",
  danger: "border-rose-400/30 bg-rose-500/10",
};

/** Copy for the stage's current status — never a claim it has not earned. */
function stageLabel(stage: VerificationStage, locale: DocumentLocale): string {
  switch (stage.status) {
    case "running":
      return localise(STAGE_RUNNING_LABEL[stage.id], locale);
    case "passed":
      return localise(STAGE_PASSED_BADGE[stage.id], locale);
    case "failed":
      return `${localise(STAGE_RUNNING_LABEL[stage.id], locale)} — failed`;
    case "skipped":
      return `${localise(STAGE_PASSED_BADGE[stage.id], locale)} — not checked`;
    case "pending":
      return `${localise(STAGE_PASSED_BADGE[stage.id], locale)} — waiting`;
  }
}

function StatusMark({ stage }: { stage: VerificationStage }) {
  const tone = STATUS_TONE[stage.status];

  if (stage.status === "running") {
    return <Loader2 className={cn("h-3.5 w-3.5 animate-spin", TONE_TEXT[tone])} aria-hidden />;
  }
  if (stage.status === "passed") {
    return (
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="inline-flex"
      >
        <Check className={cn("h-3.5 w-3.5 stroke-[3]", TONE_TEXT[tone])} aria-hidden />
      </motion.span>
    );
  }
  if (stage.status === "failed") {
    return <X className={cn("h-3.5 w-3.5 stroke-[3]", TONE_TEXT[tone])} aria-hidden />;
  }
  return <AlertTriangle className="h-3 w-3 text-slate-600" aria-hidden />;
}

/**
 * The verification pipeline for one document, stage by stage.
 *
 * The list is a live region: stages settle one at a time, and a screen-reader
 * user should hear "OCR Verified" as it happens rather than having to go back
 * and re-read the card.
 */
export function VerificationStatus({ stages, locale = "en", className }: VerificationStatusProps) {
  if (stages.length === 0) return null;

  return (
    <ul
      className={cn("space-y-1", className)}
      aria-live="polite"
      aria-label="Document verification progress"
    >
      {stages.map((stage) => {
        const Icon = STAGE_ICON[stage.id];
        const tone = STATUS_TONE[stage.status];
        const settled = stage.status !== "pending";

        return (
          <motion.li
            key={stage.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: settled ? 1 : 0.5, x: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2.5"
          >
            <span
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border",
                TONE_RING[tone],
              )}
            >
              <Icon className={cn("h-3 w-3", TONE_TEXT[tone])} aria-hidden />
            </span>

            <span className={cn("flex-1 truncate text-[11px] font-semibold", TONE_TEXT[tone])}>
              {stageLabel(stage, locale)}
              {stage.detail && (
                <span className="ml-1.5 font-medium text-slate-500">· {stage.detail}</span>
              )}
            </span>

            <StatusMark stage={stage} />
          </motion.li>
        );
      })}
    </ul>
  );
}
