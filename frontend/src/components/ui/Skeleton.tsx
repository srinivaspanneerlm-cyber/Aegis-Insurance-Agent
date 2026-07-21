import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Convenience for a rounded pill/line; defaults to the card radius. */
  circle?: boolean;
}

/**
 * Shimmer placeholder for content that is loading. Replaces ad-hoc
 * `animate-spin` for content-shaped loads (lists, cards, text lines) so the
 * layout doesn't jump when data arrives. Size it via `className`
 * (e.g. `h-4 w-32`). Decorative — hidden from the accessibility tree; announce
 * the loading state on the surrounding region instead.
 */
export function Skeleton({ circle = false, className, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-slate-200/80 dark:bg-white/10",
        circle ? "rounded-full" : "rounded-lg",
        className,
      )}
      {...rest}
    />
  );
}
