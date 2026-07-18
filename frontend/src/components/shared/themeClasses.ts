import type { Theme } from "@/context/ThemeContext";

/**
 * Theme-derived class strings shared across pages.
 *
 * `wrapperClass` and `glassCardClass` were defined identically in the About,
 * Contact, and Apply theme modules. They live here as the single source of
 * truth; the page-specific theme modules re-export these and add only their
 * own extras. Values are unchanged from the originals.
 */

/** Page wrapper background/text for the current theme. */
export const wrapperClass = (theme: Theme): string =>
  theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

/** Glassmorphic card surface used by the About/Contact section cards. */
export const glassCardClass = (theme: Theme): string =>
  theme === "dark"
    ? "bg-slate-900/40 border-white/5 shadow-2xl text-slate-300"
    : "bg-white border-slate-200/80 shadow-premium text-slate-700";
