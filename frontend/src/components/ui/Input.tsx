"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Renders the error surface + wires `aria-invalid`. Text is shown by Field. */
  invalid?: boolean;
}

const INPUT_BASE =
  "w-full rounded-xl border outline-none text-xs font-semibold transition-all " +
  "bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400 " +
  "focus:bg-white focus:border-royal-650 " +
  "dark:bg-white/[0.04] dark:border-white/10 dark:text-white dark:placeholder-slate-500 " +
  "dark:focus:bg-slate-900/60 dark:focus:border-royal-400 " +
  "focus-visible:ring-2 focus-visible:ring-brand/40 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const INVALID = "border-rose-400 focus:border-rose-500 dark:border-rose-500/60 dark:focus:border-rose-500";

/**
 * Text input carrying the app's recurring field treatment. Forwards a ref and
 * native input attributes; pair it with {@link Field} for a label + error, or
 * use standalone. Default padding is `py-3.5 px-4`; override via `className`.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(INPUT_BASE, "py-3.5 px-4", invalid && INVALID, className)}
      {...rest}
    />
  );
});

interface FieldProps {
  label: string;
  /** Optional explicit id; auto-generated (and shared with the label) if absent. */
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (fieldProps: {
    id: string;
    invalid: boolean;
    /** Set as the control's `aria-describedby` so the error is announced. */
    describedBy?: string;
  }) => ReactNode;
}

/**
 * Accessible label + control + error wrapper. Renders a real `<label htmlFor>`
 * bound to the control id (seeds the Step 4.2.1 label fix) and, on error, a
 * message referenced by `aria-describedby`. Pass the control via a render prop
 * so it receives the resolved `id` and `invalid` flag:
 *
 * ```tsx
 * <Field label="Email" error={err}>
 *   {({ id, invalid, describedBy }) => (
 *     <Input id={id} type="email" invalid={invalid} aria-describedby={describedBy} />
 *   )}
 * </Field>
 * ```
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="text-[10px] font-bold uppercase tracking-widest block text-content-muted"
      >
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children({ id, invalid: Boolean(error), describedBy: error ? errorId : undefined })}
      {error ? (
        <p id={errorId} className="text-[11px] font-semibold text-rose-500">
          {error}
        </p>
      ) : (
        hint && <p className="text-[11px] text-content-subtle">{hint}</p>
      )}
    </div>
  );
}
