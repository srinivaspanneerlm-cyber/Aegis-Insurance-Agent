"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/shared/Spinner";

export type ButtonVariant = "primary" | "gradient" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a spinner and block interaction while an action is in flight. */
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase " +
  "tracking-widest transition-all cursor-pointer border " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-0";

// Variant surfaces derive from the app's existing button treatments (Step 4.1.3
// dark: conventions preserved) so migrated call sites look unchanged.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-navy-900 hover:bg-navy-950 text-white border-navy-900 " +
    "dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-white/10",
  gradient:
    "bg-gradient-to-r from-royal-600 to-cyan-500 hover:from-royal-500 hover:to-cyan-600 " +
    "text-white border-white/10 shadow-lg",
  secondary:
    "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 " +
    "dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10",
  ghost:
    "bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 " +
    "dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "py-2 px-4 text-[10px]",
  md: "py-3.5 px-7 text-xs",
  lg: "py-4 px-8 text-xs",
};

/**
 * The app's canonical button. Consolidates the primary / gradient-CTA /
 * secondary / ghost treatments that were previously hand-written per call site.
 * Forwards a ref and every native button attribute; `className` wins over the
 * defaults via {@link cn}. `loading` disables the button and shows a spinner.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANT[variant], SIZE[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {loading ? <Spinner className="w-4 h-4 border-2 border-current" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
