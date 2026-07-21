import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardVariant = "solid" | "glass" | "outline";
export type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

// Solid uses the Step 4.1.2 surface tokens; glass reuses the existing premium
// glass utilities; outline is a hairline card with no fill.
const VARIANT: Record<CardVariant, string> = {
  solid: "bg-surface-raised border border-line text-content shadow-elevation-1",
  glass: "glass-card-premium dark:glass-card-dark-premium text-content",
  outline: "bg-transparent border border-line text-content",
};

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * Card surface primitive. Consolidates the `rounded-[32px] border …` panels
 * scattered across the app onto the semantic surface tokens. Forwards a ref and
 * native div attributes; `className` overrides the defaults via {@link cn}.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "solid", padding = "md", className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("rounded-4xl", VARIANT[variant], PADDING[padding], className)}
      {...rest}
    />
  );
});
