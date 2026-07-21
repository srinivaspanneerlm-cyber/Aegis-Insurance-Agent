/**
 * Theme-derived class strings shared across pages.
 *
 * Step 4.1.3 migrated these off the runtime `theme === "dark" ? …` ternary onto
 * the semantic design tokens / Tailwind `dark:` variant (Step 4.1.2). The page
 * wrapper now uses the `surface`/`content` tokens; the glass card keeps its
 * exact per-theme values via `dark:` (its translucent surfaces can't be tokens,
 * which hold opaque hex). No consumer needs to pass `theme` any more.
 */

/** Page wrapper background/text — semantic tokens resolve per theme. */
export const wrapperClass = "bg-surface text-content";

/** Glassmorphic card surface used by the About/Contact section cards. */
export const glassCardClass =
  "bg-white border-slate-200/80 shadow-premium text-slate-700 " +
  "dark:bg-slate-900/40 dark:border-white/5 dark:shadow-2xl dark:text-slate-300";
