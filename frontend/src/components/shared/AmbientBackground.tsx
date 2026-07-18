"use client";

import { useTheme } from "@/context/ThemeContext";

/**
 * One theme-aware ambient gradient/mesh backdrop, parametrized by page.
 *
 * Consolidates the previously-duplicated About/Contact/Home ambient
 * components. Each was the same theme-conditional fragment differing only in
 * the radial-gradient tint, blob positions/colours, and blur radii. Those
 * per-page values live in `ambientVariants`; the markup is shared here so the
 * rendered DOM stays identical to the originals.
 */

export type AmbientVariant = "home" | "about" | "contact";

interface AmbientLayer {
  /** Radial-gradient utility applied to the full-bleed backdrop div. */
  radial: string;
  /** Full className for each soft blurred blob, in render order. */
  blobs: string[];
}

export const ambientVariants: Record<
  AmbientVariant,
  { dark: AmbientLayer; light: AmbientLayer }
> = {
  home: {
    dark: {
      radial:
        "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]",
      blobs: [
        "absolute top-[10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-purple-650/10 blur-[130px] pointer-events-none",
        "absolute bottom-[20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none",
      ],
    },
    light: {
      radial:
        "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.05),rgba(255,255,255,0))]",
      blobs: [
        "absolute top-[10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-royal-100/50 blur-[90px] pointer-events-none",
      ],
    },
  },
  about: {
    dark: {
      radial:
        "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]",
      blobs: [
        "absolute top-[15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none",
        "absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none",
      ],
    },
    light: {
      radial:
        "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.04),rgba(255,255,255,0))]",
      blobs: [
        "absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-royal-100/40 blur-[100px] pointer-events-none",
      ],
    },
  },
  contact: {
    dark: {
      radial:
        "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.15),rgba(255,255,255,0))]",
      blobs: [
        "absolute top-[20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none",
        "absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none",
      ],
    },
    light: {
      radial:
        "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.04),rgba(255,255,255,0))]",
      blobs: [
        "absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-purple-100/40 blur-[100px] pointer-events-none",
      ],
    },
  },
};

/** Theme-aware ambient gradient/mesh backdrop for the given page. */
export function AmbientBackground({ variant }: { variant: AmbientVariant }) {
  const { theme } = useTheme();
  const layer =
    theme === "dark" ? ambientVariants[variant].dark : ambientVariants[variant].light;

  return (
    <>
      <div className={`absolute top-0 left-0 w-full h-full ${layer.radial}`} />
      {layer.blobs.map((blob, i) => (
        <div key={i} className={blob} />
      ))}
    </>
  );
}
