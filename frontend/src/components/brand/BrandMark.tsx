"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  AEGIS,
  AGENTS,
  GLYPHS,
  HEX_PATH,
  MONO_INK,
  VIEWBOX,
  type BrandId,
} from "./geometry";

export type MarkVariant = "color" | "mono-dark" | "mono-light";

export interface BrandMarkProps {
  brand: BrandId;
  /** Rendered pixel size. The mark is vector, so any value is sharp. */
  size?: number;
  variant?: MarkVariant;
  /** Soft outer glow, as in the master artwork. Off for print and favicons. */
  glow?: boolean;
  /** Overlay content in mark coordinates (0–128) — rings, particles, beams. */
  children?: ReactNode;
  /** Accessible name. Pass null for a mark that sits beside its own label. */
  title?: string | null;
  className?: string;
}

/**
 * Every Aegis mark, from one component.
 *
 * The five agents share a hexagon and differ only in glyph and gradient — that
 * shared silhouette is what makes them read as one family, so it is defined
 * once here rather than copied per agent. Aegis itself gets the shield and
 * chevron from the master artwork.
 *
 * Geometry and colour live in `geometry.mjs`, which the static asset pipeline
 * imports too, so what ships in `public/brand` and what renders in the app
 * cannot drift apart.
 */
export function BrandMark({
  brand,
  size = 64,
  variant = "color",
  glow = true,
  children,
  title,
  className,
}: BrandMarkProps) {
  const uid = useId().replace(/:/g, "");
  const tone = AGENTS[brand];
  const isAegis = brand === "aegis";
  const glyph = isAegis ? null : GLYPHS[brand];

  const gradId = `g-${uid}`;
  const glowId = `f-${uid}`;
  const maskId = `m-${uid}`;

  // Monochrome collapses the gradient to one ink so the mark survives a
  // one-colour print run, an embosser, or a favicon at 16px.
  const mono = variant !== "color";
  const ink = variant === "mono-light" ? MONO_INK.light : MONO_INK.dark;
  const paint = mono ? ink : `url(#${gradId})`;

  const hasCut = !mono && !!glyph?.cut?.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title ?? undefined}
      aria-hidden={title === null ? true : undefined}
      className={cn("overflow-visible", className)}
    >
      {title && <title>{title}</title>}

      <defs>
        {!mono && (
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone.deep} />
            <stop offset="100%" stopColor={tone.bright} />
          </linearGradient>
        )}

        {glow && (
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}

        {/* White keeps, black removes — this is how the windscreen and the
            visor stay genuinely transparent instead of being filled with a
            background colour that only works on one backdrop. */}
        {hasCut && (
          <mask id={maskId}>
            <rect width={VIEWBOX} height={VIEWBOX} fill="black" />
            {glyph?.fill?.map((d, i) => (
              <path key={`k${i}`} d={d} fill="white" />
            ))}
            {glyph?.cut?.map((d, i) => (
              <path key={`c${i}`} d={d} fill="black" />
            ))}
          </mask>
        )}
      </defs>

      <g filter={glow ? `url(#${glowId})` : undefined}>
        {isAegis ? (
          <>
            <path
              d={AEGIS.shield}
              stroke={paint}
              strokeWidth={5}
              strokeLinejoin="round"
              fill="none"
            />
            <path d={AEGIS.chevron} fill={paint} />
            <ellipse
              cx={AEGIS.orbit.cx}
              cy={AEGIS.orbit.cy}
              rx={AEGIS.orbit.rx}
              ry={AEGIS.orbit.ry}
              stroke={paint}
              strokeWidth={3}
              fill="none"
              opacity={0.85}
              transform={`rotate(${AEGIS.orbit.rotate} ${AEGIS.orbit.cx} ${AEGIS.orbit.cy})`}
            />
          </>
        ) : (
          <>
            <path
              d={HEX_PATH}
              stroke={paint}
              strokeWidth={5}
              strokeLinejoin="round"
              fill="none"
            />

            {/* Body. When the glyph has knock-outs the gradient is painted
                through the mask; otherwise the paths are filled directly.
                `rotate` banks the whole glyph about the canvas centre. */}
            <g
              transform={
                glyph?.rotate ? `rotate(${glyph.rotate} ${VIEWBOX / 2} ${VIEWBOX / 2})` : undefined
              }
            >
              {hasCut ? (
                <rect width={VIEWBOX} height={VIEWBOX} fill={paint} mask={`url(#${maskId})`} />
              ) : (
                glyph?.fill?.map((d, i) => <path key={`f${i}`} d={d} fill={paint} />)
              )}
            </g>

            {glyph?.stroke?.map((d, i) => (
              <path
                key={`s${i}`}
                d={d}
                stroke={mono ? ink : tone.bright}
                strokeWidth={glyph.strokeWidth ?? 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}

            {glyph?.dots?.map((dot, i) => (
              <circle
                key={`d${i}`}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={mono ? ink : tone.bright}
              />
            ))}

            {glyph?.antenna && (
              <circle
                cx={glyph.antenna.cx}
                cy={glyph.antenna.cy}
                r={glyph.antenna.r}
                fill={paint}
              />
            )}
          </>
        )}
      </g>

      {children}
    </svg>
  );
}
