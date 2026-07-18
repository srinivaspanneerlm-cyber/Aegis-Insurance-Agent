import type { Theme } from "@/context/ThemeContext";

/**
 * Theme-derived class strings for the Contact page sections.
 * `wrapperClass`/`glassCardClass` are shared with other pages (re-exported
 * from the shared module); the chat-specific helpers below stay local.
 */
export { wrapperClass, glassCardClass } from "@/components/shared/themeClasses";

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
