"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@aegis/utils";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Guidance shown before anything goes wrong. */
  hint?: string;
  /** Replaces the hint once set, and marks the field invalid. */
  error?: string;
  leadingIcon?: ReactNode;
  /** Hides the label visually but keeps it for screen readers. Use sparingly. */
  labelHidden?: boolean;
}

/**
 * A text field with its label, hint and error wired together.
 *
 * The label is a required prop, not an option. A placeholder is not a label:
 * it disappears the moment someone starts typing, which is precisely when a
 * person who is unsure what the field wants needs it most — and it is invisible
 * to screen readers as a name. Making the label mandatory means no form in any
 * of the five apps can ship without one.
 *
 * The error is tied to the input through `aria-describedby` and announced
 * politely, so it reaches someone who cannot see the red text.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, leadingIcon, labelHidden = false, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const invalid = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          "text-body-sm text-content-secondary font-semibold",
          labelHidden && "sr-only"
        )}
      >
        {label}
      </label>

      <div className="relative flex items-center">
        {leadingIcon ? (
          <span
            className="text-content-muted pointer-events-none absolute left-3"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-control rounded-control bg-surface text-body text-content w-full px-3",
            "border-line placeholder:text-content-muted border",
            "duration-fast ease-enter focus-ring transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-60",
            leadingIcon && "pl-10",
            invalid && "border-danger",
            className
          )}
          {...props}
        />
      </div>

      {invalid ? (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
