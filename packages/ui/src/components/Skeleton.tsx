import type { HTMLAttributes } from "react";
import { cn } from "@aegis/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Match the shape of what is loading, not a generic grey box. */
  variant?: "text" | "circle" | "rect";
}

/**
 * The shape of content that has not arrived.
 *
 * Better than a spinner wherever the layout is predictable: the reader's eye
 * settles into position while they wait, so the real content does not shove the
 * page around when it lands. It is also honest about how much is coming.
 *
 * Hidden from assistive technology — a screen reader user gains nothing from
 * "grey rectangle", and the region that owns the load announces the wait.
 */
export function Skeleton({ className, variant = "rect", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-surface-sunken relative overflow-hidden",
        variant === "text" && "h-4 rounded",
        variant === "circle" && "rounded-full",
        variant === "rect" && "rounded-control",
        className
      )}
      {...props}
    >
      <div className="animate-shimmer via-content/[0.06] absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent" />
    </div>
  );
}

/** Several lines of text, with the last one short like real prose. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} variant="text" className={index === lines - 1 ? "w-3/5" : "w-full"} />
      ))}
    </div>
  );
}
