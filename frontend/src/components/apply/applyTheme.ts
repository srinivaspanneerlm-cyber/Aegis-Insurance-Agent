/**
 * Class strings for the Apply flow, extracted from the page so the step
 * components stay focused on markup. Step 4.1.3 moved these off the runtime
 * `theme === "dark" ? …` ternary onto the Tailwind `dark:` variant; output is
 * unchanged per theme. Selection-dependent helpers still take `isSelected`.
 * Mirrors aboutTheme.ts / contactTheme.ts.
 */

// `wrapperClass` is shared verbatim with the About/Contact pages.
export { wrapperClass } from "@/components/shared/themeClasses";

// Light keeps its rounded/opaque card; dark swaps in the glass utility (which
// owns its own bg/border/shadow) and drops the light-only radius/text colour.
export const mainCardClass =
  "bg-white border-slate-200/80 shadow-2xl rounded-[36px] text-slate-800 " +
  "dark:glass-card-dark-premium dark:border-white/10 dark:rounded-none dark:text-inherit";

export const labelClass = "text-slate-500 dark:text-slate-400";

export const descClass = "text-slate-500 dark:text-slate-400";

export const familyBtnClass = (isSelected: boolean) =>
  isSelected
    ? "bg-royal-50 border-royal-500/45 text-navy-900 shadow-sm " +
      "dark:bg-white/5 dark:border-cyan-400/40 dark:text-white dark:shadow-none"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 " +
      "dark:bg-white/[0.02] dark:border-white/5 dark:hover:bg-white/5 dark:text-slate-300";

export const priorityBtnClass = (isSelected: boolean) =>
  isSelected
    ? "bg-royal-50 border-royal-500/40 text-navy-900 shadow-sm " +
      "dark:bg-white/5 dark:border-royal-500/40 dark:text-white dark:shadow-none"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 " +
      "dark:bg-white/[0.01] dark:border-white/5 dark:hover:bg-white/5 dark:text-slate-400";

export const budgetBtnClass = (isSelected: boolean) =>
  isSelected
    ? "bg-navy-900 text-white border-navy-900 shadow-lg font-black " +
      "dark:bg-white dark:text-slate-950 dark:border-white"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 font-bold " +
      "dark:bg-white/[0.02] dark:border-white/5 dark:hover:bg-white/5 dark:text-slate-400";

export const inputClass =
  "bg-slate-100/60 focus:bg-white border-slate-250 focus:border-royal-650 text-navy-900 shadow-inner " +
  "dark:bg-white/5 dark:focus:bg-white/[0.08] dark:border-white/10 dark:focus:border-royal-500 dark:text-white dark:shadow-none";

export const finalCardBorder =
  "border-royal-600 shadow-premium dark:border-cyan-400 dark:shadow-none";
