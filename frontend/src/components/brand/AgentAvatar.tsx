"use client";

import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { AGENTS, type BrandId } from "./geometry";

export interface AgentAvatarProps {
  brand: BrandId;
  /** Outer tile size in px. The mark is drawn inside it. */
  size?: number;
  /**
   * Accessible name. Defaults to `null` — decorative — because in chat the
   * agent's name is already printed directly beside the avatar, and reading it
   * out twice is noise for a screen-reader user rather than help.
   */
  title?: string | null;
  className?: string;
}

/**
 * The agent's own mark, sized for a chat avatar.
 *
 * The marks carry 12px of safe padding on a 128 canvas precisely so they can be
 * dropped into an avatar slot, so this adds no inset of its own — only the tile
 * behind them. That tile is a low-saturation wash of the agent's palette over a
 * dark base rather than the full gradient: a saturated background under a
 * gradient mark flattens the glyph into a coloured blob at this size, and the
 * glyph is the whole point. The glow is off for the same reason — at 36px a
 * Gaussian blur eats the thin strokes it is meant to flatter.
 *
 * The base stays dark in light mode too. Every mark's gradient runs from a deep
 * tone to a bright one, and the bright end is a pastel — on a white card the
 * lower half of the glyph would simply disappear. Keeping the badge on dark is
 * also how the master artwork sets them, so this matches rather than invents.
 */
export function AgentAvatar({ brand, size = 36, title = null, className }: AgentAvatarProps) {
  const tone = AGENTS[brand];

  return (
    <div
      className={cn("relative flex items-center justify-center flex-shrink-0 border", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: `linear-gradient(135deg, ${tone.deep}59, ${tone.bright}1F), #0B1220`,
        borderColor: `${tone.bright}30`,
        boxShadow: `0 0 ${Math.round(size * 0.4)}px ${tone.glow.replace(/[\d.]+\)$/, "0.18)")}`,
      }}
    >
      <BrandMark brand={brand} size={Math.round(size * 0.92)} glow={false} title={title} />
    </div>
  );
}
