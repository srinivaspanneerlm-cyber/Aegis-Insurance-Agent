"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@aegis/utils";
import { Icon } from "@/components/Icon";

export interface PasswordFieldProps {
  label: string;
  name: string;
  error?: string | undefined;
  hint?: string | undefined;
  autoComplete?: string | undefined;
  required?: boolean | undefined;
  /** Shows a strength meter and the rules. Off for a plain sign-in field. */
  showStrength?: boolean | undefined;
  /** Length required by the realm this password is for. */
  minLength?: number | undefined;
}

/**
 * A password input that helps rather than scolds.
 *
 * Two decisions worth stating:
 *
 * The reveal toggle is a real button with a label, not an eye glyph alone.
 * Typing a long passphrase blind on a phone is how people give up and choose
 * something short, which is the opposite of what the policy is trying to buy.
 *
 * The strength meter is driven by length first, matching the server's policy,
 * and it never blocks anything — it is guidance, and the server decides. A
 * meter that disagrees with the API is worse than none, so this only ever
 * reports what the server would already accept.
 */
export function PasswordField({
  label,
  name,
  error,
  hint,
  autoComplete = "current-password",
  required = true,
  showStrength = false,
  minLength = 10,
}: PasswordFieldProps) {
  const id = useId();
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);

  const describedBy = [hint || showStrength ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  const strength = useMemo(() => rate(value, minLength), [value, minLength]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body-sm font-medium text-content">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={revealed ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-control-lg w-full rounded-control border bg-surface-raised/50 pl-4 pr-12 text-body text-content",
            "transition-colors duration-fast ease-enter placeholder:text-content-muted",
            "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50",
            error && "border-danger focus:ring-danger/40"
          )}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          // The label carries the state, so a screen reader hears what pressing
          // it will do rather than just "button".
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          className="focus-ring absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-control text-content-muted transition-colors hover:text-content"
        >
          <Icon name={revealed ? "lock" : "eye"} size={18} />
        </button>
      </div>

      {showStrength ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1 flex-1 rounded-pill transition-colors",
                  step < strength.score ? strength.colour : "bg-surface-raised/60"
                )}
              />
            ))}
          </div>
          {/* Announced politely: it updates on every keystroke, and an assertive
              region would interrupt the person typing. */}
          <p id={`${id}-hint`} aria-live="polite" className="text-caption text-content-muted">
            {value
              ? strength.message
              : (hint ?? `At least ${minLength} characters. A short phrase works well.`)}
          </p>
        </div>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-content-muted">
          {hint}
        </p>
      ) : null}

      <p id={`${id}-error`} role="alert" className="text-caption text-danger empty:hidden">
        {error ?? ""}
      </p>
    </div>
  );
}

/**
 * Length-led, exactly as the server's policy is.
 *
 * Character classes contribute only above the length floor, so the meter never
 * tells someone that `Pa$$w0rd` is better than `chennai monsoon rain`.
 */
function rate(value: string, minLength: number) {
  if (!value) return { score: 0, colour: "bg-surface-raised/60", message: "" };

  if (value.length < minLength) {
    return {
      score: 1,
      colour: "bg-danger",
      message: `${minLength - value.length} more character${minLength - value.length === 1 ? "" : "s"} needed.`,
    };
  }

  const distinct = new Set(value).size;
  const hasSpace = /\s/.test(value);

  if (value.length >= minLength + 8 || (hasSpace && value.length >= minLength + 4)) {
    return { score: 4, colour: "bg-success", message: "Strong — that will do nicely." };
  }
  if (distinct >= 8) {
    return { score: 3, colour: "bg-success", message: "Good. Longer is stronger still." };
  }
  return {
    score: 2,
    colour: "bg-warning",
    message: "Acceptable. A few more words would be better.",
  };
}
