import type { ReactNode } from "react";
import { cn } from "@aegis/utils";

export interface SectionProps {
  children: ReactNode;
  /** Anchor target for in-page navigation and footer deep links. */
  id?: string;
  /** Wider than the default column, for grids that need the room. */
  width?: "default" | "wide" | "narrow";
  /** Vertical rhythm. `tight` is for sections that follow a related one. */
  spacing?: "tight" | "default" | "loose";
  /** A faint tint that separates neighbouring sections without a hard rule. */
  tone?: "none" | "sunken";
  className?: string;
  /** Renders as <section> by default; pass a landmark where one is meaningful. */
  as?: "section" | "div";
  "aria-labelledby"?: string;
}

const WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

const SPACING = {
  tight: "py-12 sm:py-16",
  default: "py-16 sm:py-24",
  loose: "py-20 sm:py-32",
} as const;

/**
 * One page section: the vertical rhythm, the column width and the optional
 * tint, decided once.
 *
 * Marketing pages are mostly the same shape repeated, and letting each one pick
 * its own padding is how a site ends up with eleven slightly different gaps
 * that read as carelessness long before anyone can say why.
 */
export function Section({
  children,
  id,
  width = "default",
  spacing = "default",
  tone = "none",
  className,
  as: Tag = "section",
  ...rest
}: SectionProps) {
  return (
    <Tag
      id={id}
      // Anchored sections need room for the sticky header, or the heading lands
      // underneath it and the customer thinks the link is broken.
      className={cn(
        "relative w-full scroll-mt-24",
        tone === "sunken" && "bg-surface-sunken/40",
        SPACING[spacing],
        className
      )}
      {...rest}
    >
      <div className={cn("mx-auto w-full px-gutter", WIDTHS[width])}>{children}</div>
    </Tag>
  );
}

export interface SectionHeadingProps {
  /** Small uppercase label above the title. Optional and often better omitted. */
  overline?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Ties the section's landmark to its heading for assistive technology. */
  id?: string;
  align?: "left" | "center";
  /** Heading level. Only one h1 per page, so sections default to h2. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

export function SectionHeading({
  overline,
  title,
  description,
  id,
  align = "left",
  as: Tag = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "mx-auto max-w-3xl text-center",
        className
      )}
    >
      {overline ? (
        <p className="text-overline font-semibold uppercase text-brand">{overline}</p>
      ) : null}
      <Tag
        id={id}
        className={cn(
          "text-balance font-bold tracking-tight text-content",
          Tag === "h1" ? "text-display sm:text-display-lg" : "text-h1"
        )}
      >
        {title}
      </Tag>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-pretty text-body text-content-secondary sm:text-lg",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
