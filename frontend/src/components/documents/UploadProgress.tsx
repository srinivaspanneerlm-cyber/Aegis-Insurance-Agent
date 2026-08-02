"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { StatusTone } from "./statusMeta";

interface UploadProgressProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Announced to screen readers, e.g. "Uploading RC Book". */
  label: string;
  /** Short right-aligned caption, e.g. "2.4 MB of 8 MB". */
  caption?: string;
  tone?: StatusTone;
  className?: string;
}

const TRACK = "h-1.5 w-full overflow-hidden rounded-full bg-white/8";

const FILL: Record<StatusTone, string> = {
  neutral: "bg-slate-400/70",
  info: "bg-gradient-to-r from-cyan-500 to-blue-500",
  success: "bg-gradient-to-r from-emerald-500 to-teal-400",
  warning: "bg-gradient-to-r from-amber-500 to-orange-400",
  danger: "bg-gradient-to-r from-rose-500 to-red-500",
};

/**
 * The animated bar shown while a document moves through its pipeline.
 *
 * It is a real `progressbar` rather than a decorated div so assistive tech
 * reports the percentage; the visible caption carries the same information for
 * everyone else.
 */
export function UploadProgress({
  value,
  label,
  caption,
  tone = "info",
  className,
}: UploadProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={cn("space-y-1.5", className)}>
      {caption && (
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-500">
          <span className="truncate">{label}</span>
          <span className="flex-shrink-0 tabular-nums text-slate-400">{caption}</span>
        </div>
      )}

      <div
        className={TRACK}
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className={cn("h-full rounded-full", FILL[tone])}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
        />
      </div>
    </div>
  );
}
