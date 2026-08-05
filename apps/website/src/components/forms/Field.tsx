"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@aegis/utils";

/**
 * `| undefined` is written out on every optional prop because the workspace
 * enables `exactOptionalPropertyTypes`. Under that rule `error?: string` means
 * "may be absent", not "may be undefined" — and passing a value that happens to
 * be undefined is an error. Spelling it out is what lets a caller write
 * `error={errors.name}` without a conditional at every call site.
 */
interface BaseProps {
  label: string;
  name: string;
  error?: string | undefined;
  /** Guidance shown before anything goes wrong — cheaper than an error. */
  hint?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
}

const CONTROL = [
  "w-full rounded-control border bg-surface-raised/50 px-4 text-body text-content",
  "placeholder:text-content-muted",
  "duration-fast ease-enter transition-colors",
  "focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand",
  "disabled:opacity-60 disabled:cursor-not-allowed",
].join(" ");

/**
 * A labelled form control.
 *
 * Three things this exists to get right, every time, on every form:
 *
 *  - The label is a real `<label>` bound by id. A placeholder is not a label —
 *    it disappears the moment someone types, which is exactly when a person
 *    filling in a long form needs it most.
 *  - The error is tied to the input by `aria-describedby` and announced by a
 *    live region, so a screen-reader user learns what is wrong without hunting.
 *  - `aria-invalid` marks the field itself, rather than relying on a red border
 *    that a colour-blind visitor may not perceive at all.
 */
export function Field({
  label,
  name,
  error,
  hint,
  required,
  disabled,
  type = "text",
  placeholder,
  autoComplete,
}: BaseProps & {
  type?: string | undefined;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(CONTROL, "h-control-lg", error && "border-danger focus:ring-danger/40")}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  name,
  error,
  hint,
  required,
  disabled,
  placeholder,
  rows = 5,
}: BaseProps & { placeholder?: string | undefined; rows?: number | undefined }) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(CONTROL, "resize-y py-3", error && "border-danger focus:ring-danger/40")}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  name,
  error,
  hint,
  required,
  disabled,
  options,
  placeholder,
}: BaseProps & { options: readonly string[]; placeholder?: string | undefined }) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        defaultValue=""
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(CONTROL, "h-control-lg", error && "border-danger focus:ring-danger/40")}
      >
        <option value="" disabled>
          {placeholder ?? "Please choose"}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body-sm font-medium text-content">
        {label}
        {/* "Optional" would be the kinder marker, but these forms are mostly
            required; marking the exception is less visual noise. The asterisk
            is hidden from assistive tech because `required` already says it. */}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : (
          <span className="ml-2 font-normal text-content-muted">(optional)</span>
        )}
      </label>

      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-content-muted">
          {hint}
        </p>
      ) : null}

      {children}

      {/* Present in the DOM before it has anything to say, so the live region is
          already being watched when the message arrives. A region inserted at
          the same moment as its content is frequently missed. */}
      <p id={`${id}-error`} role="alert" className="text-caption text-danger empty:hidden">
        {error ?? ""}
      </p>
    </div>
  );
}
