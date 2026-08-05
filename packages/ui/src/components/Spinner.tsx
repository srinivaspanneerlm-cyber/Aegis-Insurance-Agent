import type { HTMLAttributes } from "react";
import { cn } from "@aegis/utils";

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof sizes;
  /** Announced to assistive tech. Pass null when a parent already says it. */
  label?: string | null;
}

/**
 * An indeterminate wait.
 *
 * Use where the duration is genuinely unknown. Where a layout is coming,
 * `Skeleton` is better: it shows the shape of what is arriving instead of
 * asking the reader to hold an empty screen in their head.
 */
export function Spinner({ className, size = "md", label = "Loading", ...props }: SpinnerProps) {
  return (
    <span
      role={label === null ? undefined : "status"}
      aria-label={label === null ? undefined : label}
      className={cn("inline-block", className)}
      {...props}
    >
      <span
        className={cn(
          "block animate-spin rounded-full border-current border-t-transparent opacity-70",
          sizes[size]
        )}
      />
    </span>
  );
}
