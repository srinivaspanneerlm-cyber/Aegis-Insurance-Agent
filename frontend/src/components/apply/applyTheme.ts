/**
 * Theme-dependent class strings for the Apply flow, extracted from the page so
 * the step components stay focused on markup. Pure functions of `theme` (and,
 * where relevant, a selected flag) — identical output to the original inline
 * class helpers. Mirrors aboutTheme.ts / contactTheme.ts.
 */
import type { Theme } from "@/context/ThemeContext";

// `wrapperClass` is shared verbatim with the About/Contact pages.
export { wrapperClass } from "@/components/shared/themeClasses";

export const mainCardClass = (theme: Theme) =>
  theme === "dark"
    ? "glass-card-dark-premium border-white/10"
    : "bg-white border-slate-200/80 shadow-2xl rounded-[36px] text-slate-800";

export const labelClass = (theme: Theme) =>
  theme === "dark" ? "text-slate-400" : "text-slate-500";

export const descClass = (theme: Theme) =>
  theme === "dark" ? "text-slate-400" : "text-slate-500";

export const familyBtnClass = (theme: Theme, isSelected: boolean) => {
  if (theme === "dark") {
    return isSelected
      ? "bg-white/5 border-cyan-400/40 text-white"
      : "bg-white/[0.02] border-white/5 hover:bg-white/5 text-slate-300";
  }
  return isSelected
    ? "bg-royal-50 border-royal-500/45 text-navy-900 shadow-sm"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700";
};

export const priorityBtnClass = (theme: Theme, isSelected: boolean) => {
  if (theme === "dark") {
    return isSelected
      ? "bg-white/5 border-royal-500/40 text-white"
      : "bg-white/[0.01] border-white/5 hover:bg-white/5 text-slate-400";
  }
  return isSelected
    ? "bg-royal-50 border-royal-500/40 text-navy-900 shadow-sm"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600";
};

export const budgetBtnClass = (theme: Theme, isSelected: boolean) => {
  if (theme === "dark") {
    return isSelected
      ? "bg-white text-slate-950 border-white shadow-lg font-black"
      : "bg-white/[0.02] border-white/5 hover:bg-white/5 text-slate-400 font-bold";
  }
  return isSelected
    ? "bg-navy-900 text-white border-navy-900 shadow-lg font-black"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 font-bold";
};

export const inputClass = (theme: Theme) =>
  theme === "dark"
    ? "bg-white/5 focus:bg-white/[0.08] border-white/10 focus:border-royal-500 text-white"
    : "bg-slate-100/60 focus:bg-white border-slate-250 focus:border-royal-650 text-navy-900 shadow-inner";

export const finalCardBorder = (theme: Theme) =>
  theme === "dark" ? "border-cyan-400" : "border-royal-600 shadow-premium";
