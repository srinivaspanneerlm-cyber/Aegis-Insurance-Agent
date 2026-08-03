"use client";

import { cn } from "@/lib/cn";

interface ChoiceCardProps {
  label: string;
  hint: string;
  /** Emoji or short glyph shown in the leading tile. Optional. */
  glyph?: string;
  selected: boolean;
  /** `radio` for a single-choice question, `checkbox` for a multi-choice one —
   *  the two questions differ only in this, so they share one control. */
  role: "radio" | "checkbox";
  onSelect: () => void;
}

/**
 * One answer on an onboarding screen.
 *
 * A real radio/checkbox rather than a styled div: our audience includes senior
 * citizens and screen-reader users, and a button that only *looks* selectable
 * announces nothing. Hit areas are deliberately large for the same reason.
 */
export function ChoiceCard({ label, hint, glyph, selected, role, onSelect }: ChoiceCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
        "active:scale-[0.99] touch-manipulation",
        selected
          ? "border-rose-400/50 bg-rose-500/10 shadow-[0_0_25px_rgba(244,63,94,0.12)]"
          : "border-slate-200 bg-white hover:border-rose-300 dark:border-white/8 dark:bg-white/[0.02] dark:hover:border-rose-500/30 dark:hover:bg-white/[0.04]"
      )}
    >
      {glyph && (
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl dark:border-white/8 dark:bg-white/5"
          aria-hidden
        >
          {glyph}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-bold",
            selected ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-slate-100"
          )}
        >
          {label}
        </span>
        <span className="block text-[12px] font-medium text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>

      <span
        className={cn(
          "flex h-5 w-5 flex-shrink-0 items-center justify-center border transition-colors",
          role === "radio" ? "rounded-full" : "rounded-md",
          selected
            ? "border-rose-400 bg-rose-500"
            : "border-slate-300 bg-transparent dark:border-white/15"
        )}
        aria-hidden
      >
        {selected && <span className="block h-2 w-2 rounded-full bg-white" />}
      </span>
    </button>
  );
}
