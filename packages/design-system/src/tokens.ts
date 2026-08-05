/**
 * Typed names for the design tokens.
 *
 * Deliberately types and names — not a second copy of the values. The values
 * live in exactly one place each (`theme.css` for colour, the Tailwind preset
 * for scale), and duplicating them here to be "convenient" would guarantee the
 * two drift apart. What TypeScript adds is the part CSS cannot: a compile error
 * when a component asks for a token that does not exist.
 */

export const SEMANTIC_COLORS = [
  "canvas",
  "surface",
  "surface-raised",
  "surface-sunken",
  "overlay",
  "content",
  "content-secondary",
  "content-muted",
  "content-inverted",
  "line-subtle",
  "line",
  "line-strong",
  "brand",
  "brand-hover",
  "brand-fg",
  "accent",
  "accent-fg",
  "success",
  "warning",
  "danger",
  "info",
] as const;

export type SemanticColor = (typeof SEMANTIC_COLORS)[number];

export const ELEVATIONS = ["raised", "floating", "overlay", "glass"] as const;
export type Elevation = (typeof ELEVATIONS)[number];

export const RADII = ["control", "card", "panel", "pill"] as const;
export type Radius = (typeof RADII)[number];

export const TYPE_SCALE = [
  "display-lg",
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "body",
  "body-sm",
  "caption",
  "overline",
] as const;
export type TypeScale = (typeof TYPE_SCALE)[number];

export const DURATIONS = ["instant", "fast", "base", "slow"] as const;
export type Duration = (typeof DURATIONS)[number];

/** The two themes, plus "follow the operating system". */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

/** The resolved outcome — `system` has been answered by the time this is used. */
export type ResolvedTheme = Exclude<Theme, "system">;
