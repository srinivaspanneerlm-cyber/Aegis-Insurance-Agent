import { cn } from "@aegis/utils";

export interface ProgressProps {
  /** 0–100. Omit for an indeterminate bar. */
  value?: number;
  label: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Progress along a task the customer can see the end of.
 *
 * Determinate wherever the total is known — a multi-step application, a file
 * upload — because "step 3 of 5" is the difference between waiting and
 * wondering whether it has frozen. The indeterminate form is a fallback, not
 * the default.
 */
export function Progress({ value, label, className, size = "md" }: ProgressProps) {
  const determinate = typeof value === "number";
  const clamped = determinate ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(clamped) : undefined}
      className={cn(
        "rounded-pill bg-surface-sunken relative w-full overflow-hidden",
        size === "sm" ? "h-1" : "h-2",
        className
      )}
    >
      {determinate ? (
        <div
          className="rounded-pill bg-brand duration-base ease-enter h-full transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      ) : (
        <div className="animate-indeterminate-bar rounded-pill bg-brand h-full w-1/3" />
      )}
    </div>
  );
}
