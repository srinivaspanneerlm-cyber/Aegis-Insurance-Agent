import type { Theme } from "@/context/ThemeContext";

/**
 * Theme-derived class strings shared across the About page sections.
 *
 * These were previously computed once inside the monolithic About page and
 * threaded through every section. Centralizing them here keeps the extracted
 * section components consistent and avoids re-deriving the same conditional
 * class in several files. Values are identical to the original inline strings.
 */

/** Page wrapper background/text for the current theme. */
export const wrapperClass = (theme: Theme): string =>
  theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

/** Glassmorphic card surface used by the vision, values, and feature cards. */
export const glassCardClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-slate-900/40 border-white/5 shadow-2xl text-slate-300"
    : "bg-white border-slate-200/80 shadow-premium text-slate-700";
