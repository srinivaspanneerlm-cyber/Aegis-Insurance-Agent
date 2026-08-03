/** Types for `geometry.mjs` — see that file for the reasoning. */

export const VIEWBOX: number;
export const SAFE_PADDING: number;
export const HEX_PATH: string;
export const HEX_RING_PATH: string;

export interface OrbitSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
}

export const AEGIS: {
  shield: string;
  chevron: string;
  orbit: OrbitSpec;
};

export interface Dot {
  cx: number;
  cy: number;
  r: number;
}

export interface Glyph {
  /** Solid shapes. */
  fill?: string[];
  /** Shapes knocked out of `fill` (windscreens, visors). */
  cut?: string[];
  /** Outlines — these are what the "draws itself" animations trace. */
  stroke?: string[];
  dots?: Dot[];
  antenna?: Dot;
  /** Degrees to bank the glyph about the canvas centre (the aircraft). */
  rotate?: number;
  /** Stroke weight for this glyph's outlines. Defaults to 4. */
  strokeWidth?: number;
}

export const GLYPHS: Record<AgentId, Glyph>;

export type AgentId = "alex" | "sarah" | "emma" | "ethan" | "nova";
export type BrandId = AgentId | "aegis";

export interface BrandTone {
  id: BrandId;
  name: string;
  role: string;
  /** Shadowed tone — the gradient start. */
  deep: string;
  /** Lit tone — the gradient end. */
  bright: string;
  /** Pre-mixed rgba for glow filters. */
  glow: string;
}

export const AGENTS: Record<BrandId, BrandTone>;
export const AGENT_ORDER: AgentId[];
export const MONO_INK: { dark: string; light: string };
