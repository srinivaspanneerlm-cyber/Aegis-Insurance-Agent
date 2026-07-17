import type { Theme } from "@/context/ThemeContext";

/**
 * Theme-derived class strings for the Contact page sections.
 * Extracted verbatim from the original page so the extracted section
 * components share one definition instead of each re-deriving it.
 */

export const wrapperClass = (theme: Theme): string =>
  theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

export const glassCardClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-slate-900/40 border-white/5 shadow-2xl text-slate-300"
    : "bg-white border-slate-200/80 shadow-premium text-slate-700";

export const chatBgClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-slate-900/60 border-white/5 shadow-2xl"
    : "bg-white border-slate-200 shadow-premium";

export const advisorBubbleClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-slate-950 border-white/5 text-slate-200"
    : "bg-slate-100 border-slate-200 text-slate-700 shadow-sm";

export const userBubbleClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-purple-600/20 border-purple-500/20 text-purple-200"
    : "bg-purple-50 border-purple-200/80 text-purple-700 shadow-sm font-medium";

export const inputClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-slate-950 border-white/10 focus:border-purple-500 text-white"
    : "bg-slate-150 border-slate-250 focus:border-purple-650 text-navy-900 focus:bg-white shadow-inner";
