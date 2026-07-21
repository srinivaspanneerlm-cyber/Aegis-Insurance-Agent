/**
 * Theme-derived class strings for the Contact page sections.
 * `wrapperClass`/`glassCardClass` are shared with other pages (re-exported
 * from the shared module); the chat-specific strings below stay local. Step
 * 4.1.3 moved these onto the Tailwind `dark:` variant (values unchanged; the
 * translucent bubble surfaces keep raw colors since tokens hold opaque hex).
 */
export { wrapperClass, glassCardClass } from "@/components/shared/themeClasses";

export const chatBgClass =
  "bg-white border-slate-200 shadow-premium " +
  "dark:bg-slate-900/60 dark:border-white/5 dark:shadow-2xl";

export const advisorBubbleClass =
  "bg-slate-100 border-slate-200 text-slate-700 shadow-sm " +
  "dark:bg-slate-950 dark:border-white/5 dark:text-slate-200 dark:shadow-none";

export const userBubbleClass =
  "bg-purple-50 border-purple-200/80 text-purple-700 shadow-sm font-medium " +
  "dark:bg-purple-600/20 dark:border-purple-500/20 dark:text-purple-200 dark:shadow-none dark:font-normal";

export const inputClass =
  "bg-slate-150 border-slate-250 focus:border-purple-650 text-navy-900 focus:bg-white shadow-inner " +
  "dark:bg-slate-950 dark:border-white/10 dark:focus:border-purple-500 dark:text-white dark:focus:bg-slate-950 dark:shadow-none";
