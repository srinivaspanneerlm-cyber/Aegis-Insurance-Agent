import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 " +
  "text-[10px] font-bold uppercase tracking-widest leading-none";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  brand: "bg-royal-50 text-royal-600 dark:bg-royal-500/15 dark:text-royal-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

/**
 * Small status pill for the uppercase-tracked chips used across the app
 * (statuses, tags, counts). Non-interactive by default; pass an `onClick` and
 * `role`/`tabIndex` at the call site if it must be actionable.
 */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return <span className={cn(BASE, TONE[tone], className)} {...rest} />;
}
