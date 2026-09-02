"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale, LocalisedText } from "@/types/documents";

/**
 * The form controls, sized for the people this is for.
 *
 * Deliberately not the app's `Input` primitive. That one is built for dense
 * staff screens — small uppercase labels, tight padding — and this form is read
 * by first-time buyers and senior citizens on phones. 16px input text is also
 * what stops iOS zooming the page on focus, which throws the layout and loses
 * somebody's place mid-form.
 *
 * Every field takes its error as `LocalisedText` and renders it beside the
 * input, tied by `aria-describedby`, so a screen reader announces the problem
 * with the field rather than leaving it somewhere else on the page.
 */

interface FieldShellProps {
  label: LocalisedText;
  hint?: LocalisedText;
  error?: LocalisedText;
  locale: DocumentLocale;
  required?: boolean;
  children: (ids: { inputId: string; describedBy: string | undefined }) => React.ReactNode;
}

function FieldShell({ label, hint, error, locale, required, children }: FieldShellProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-content">
        {localise(label, locale)}
        {/* Marked where it is optional, not where it is required. Most fields
            here are required, and a page of asterisks reads as a demand. */}
        {!required && (
          <span className="ml-1.5 text-xs font-medium text-content-subtle">(optional)</span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-xs font-medium leading-relaxed text-content-muted">
          {localise(hint, locale)}
        </p>
      )}

      {children({ inputId, describedBy: describedBy || undefined })}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-semibold leading-relaxed text-rose-600 dark:text-rose-400"
        >
          {localise(error, locale)}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-2xl border bg-surface-raised px-4 py-3.5 text-base font-medium text-content " +
  "placeholder:text-content-subtle transition-colors " +
  "focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

const controlTone = (invalid: boolean) =>
  invalid ? "border-rose-400 dark:border-rose-500/50" : "border-line";

export interface TextFieldProps {
  label: LocalisedText;
  hint?: LocalisedText;
  error?: LocalisedText;
  locale: DocumentLocale;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  inputMode?: "text" | "numeric";
  autoCapitalize?: string;
  name: string;
}

export function TextField({
  value,
  onChange,
  placeholder,
  inputMode = "text",
  autoCapitalize,
  name,
  ...shell
}: TextFieldProps) {
  return (
    <FieldShell {...shell}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={shell.error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(CONTROL, controlTone(!!shell.error))}
        />
      )}
    </FieldShell>
  );
}

export interface DateFieldProps {
  label: LocalisedText;
  hint?: LocalisedText;
  error?: LocalisedText;
  locale: DocumentLocale;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  name: string;
}

/**
 * A native date input.
 *
 * Native rather than a custom picker on purpose: it is the control the person
 * already knows from every other app on their phone, it is localised and
 * accessible for free, and it cannot be typed into in the wrong order.
 */
export function DateField({ value, onChange, name, ...shell }: DateFieldProps) {
  return (
    <FieldShell {...shell}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          name={name}
          type="date"
          value={value}
          aria-describedby={describedBy}
          aria-invalid={shell.error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(CONTROL, controlTone(!!shell.error))}
        />
      )}
    </FieldShell>
  );
}

export interface ChoiceOption<T extends string> {
  id: T;
  label: LocalisedText;
  meaning: LocalisedText;
}

export interface ChoiceFieldProps<T extends string> {
  legend: LocalisedText;
  hint?: LocalisedText;
  error?: LocalisedText;
  locale: DocumentLocale;
  options: readonly ChoiceOption<T>[];
  value: string;
  onChange: (value: T) => void;
  name: string;
}

/**
 * A stack of large radio cards, not a `<select>`.
 *
 * A dropdown hides the options until it is opened and shows one line each when
 * it is — which is no use when the whole difficulty is that the customer does
 * not know what the options mean. Each choice carries its explanation on the
 * card, visible before the decision rather than after it.
 */
export function ChoiceField<T extends string>({
  legend,
  hint,
  error,
  locale,
  options,
  value,
  onChange,
  name,
}: ChoiceFieldProps<T>) {
  const groupId = useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-bold text-content">{localise(legend, locale)}</legend>
      {hint && (
        <p className="text-xs font-medium leading-relaxed text-content-muted">
          {localise(hint, locale)}
        </p>
      )}

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-describedby={error ? errorId : undefined}>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              data-testid={`choice-${name}-${option.id}`}
              data-selected={selected}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all",
                // The whole card is the target, not the 20px circle.
                selected
                  ? "border-brand bg-brand/5 shadow-elevation-1"
                  : "border-line bg-surface-raised hover:border-brand/40"
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected ? "border-brand bg-brand text-white" : "border-line-strong"
                )}
              >
                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold leading-snug text-content">
                  {localise(option.label, locale)}
                </span>
                <span className="mt-1 block text-sm font-medium leading-relaxed text-content-muted">
                  {localise(option.meaning, locale)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-semibold leading-relaxed text-rose-600 dark:text-rose-400"
        >
          {localise(error, locale)}
        </p>
      )}
    </fieldset>
  );
}
