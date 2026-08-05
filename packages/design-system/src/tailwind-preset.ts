import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * The scale tokens — typography, spacing, radius, shadow, motion — and the
 * bridge from Tailwind utilities to the colour variables in `theme.css`.
 *
 * This preset is the *only* place these values are written down. Every app
 * spreads it into its own `tailwind.config.ts`, so "what is a large radius" has
 * exactly one answer across five applications. An app may extend the scale for
 * something genuinely local, but it cannot redefine a token — that is the line
 * between a design system and five codebases that merely look similar.
 *
 * Colour is *not* defined here, only referenced. See `theme.css` for why.
 */

/** `rgb(var(--x) / <alpha-value>)` — the form that keeps `bg-surface/60` working. */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

export const aegisPreset = {
  darkMode: "class",
  content: [],
  theme: {
    extend: {
      colors: {
        canvas: withAlpha("--aegis-canvas"),
        surface: {
          DEFAULT: withAlpha("--aegis-surface"),
          raised: withAlpha("--aegis-surface-raised"),
          sunken: withAlpha("--aegis-surface-sunken"),
        },
        overlay: withAlpha("--aegis-overlay"),
        content: {
          DEFAULT: withAlpha("--aegis-text"),
          secondary: withAlpha("--aegis-text-secondary"),
          muted: withAlpha("--aegis-text-muted"),
          inverted: withAlpha("--aegis-text-inverted"),
        },
        line: {
          subtle: withAlpha("--aegis-border-subtle"),
          DEFAULT: withAlpha("--aegis-border"),
          strong: withAlpha("--aegis-border-strong"),
        },
        brand: {
          DEFAULT: withAlpha("--aegis-brand"),
          hover: withAlpha("--aegis-brand-hover"),
          fg: withAlpha("--aegis-brand-fg"),
        },
        accent: {
          DEFAULT: withAlpha("--aegis-accent"),
          fg: withAlpha("--aegis-accent-fg"),
        },
        success: withAlpha("--aegis-success"),
        warning: withAlpha("--aegis-warning"),
        danger: withAlpha("--aegis-danger"),
        info: withAlpha("--aegis-info"),
        "status-fg": withAlpha("--aegis-status-fg"),
      },

      /**
       * A 4px rhythm, named by intent rather than by number.
       *
       * Tailwind's numeric scale stays available; these add the handful of
       * sizes that carry meaning, so a reviewer can tell "this gap is one step"
       * from "someone typed 13".
       */
      spacing: {
        gutter: "1.5rem", // page/card inner padding
        section: "4rem", // vertical rhythm between page sections
        "control-sm": "2rem", // 32px — small control height
        control: "2.75rem", // 44px — the minimum comfortable touch target
        "control-lg": "3.25rem", // 52px — primary actions, senior-friendly
      },

      /**
       * Type scale.
       *
       * Body sits at 16px and is not negotiable: this platform serves people
       * with presbyopia, and anything smaller is a barrier disguised as
       * elegance. Line heights are paired with each size so vertical rhythm
       * cannot drift.
       */
      fontSize: {
        "display-lg": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        display: ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h1: ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        h2: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        h3: ["1.375rem", { lineHeight: "1.3" }],
        h4: ["1.125rem", { lineHeight: "1.4" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55" }],
        caption: ["0.8125rem", { lineHeight: "1.5" }],
        overline: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.14em" }],
      },

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },

      borderRadius: {
        control: "0.75rem",
        card: "1.25rem",
        panel: "1.75rem",
        pill: "9999px",
      },

      /**
       * Elevation is a ladder, not a set of options. Each step is one level of
       * "closer to the reader": raised → floating → overlay. Skipping steps is
       * how interfaces end up with six shadows that all look like an accident.
       */
      boxShadow: {
        raised: "0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.1)",
        floating: "0 4px 12px rgb(15 23 42 / 0.08), 0 12px 32px rgb(15 23 42 / 0.08)",
        overlay: "0 24px 64px rgb(15 23 42 / 0.24)",
        glass: "var(--aegis-glass-shadow)",
        focus: "0 0 0 3px rgb(var(--aegis-ring) / 0.4)",
      },

      backdropBlur: {
        glass: "var(--aegis-glass-blur)",
      },

      /**
       * Motion tokens.
       *
       * Durations are short because this is an insurance portal, not a
       * showreel: the longest is a modal, and even that is under a third of a
       * second. `enter`/`exit` are asymmetric on purpose — things should leave
       * faster than they arrive, or the interface feels like it is arguing.
       */
      transitionDuration: {
        instant: "80ms",
        fast: "140ms",
        base: "200ms",
        slow: "320ms",
      },
      transitionTimingFunction: {
        enter: "cubic-bezier(0.16, 1, 0.3, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
        emphasis: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "indeterminate-bar": {
          "0%": { transform: "translateX(-100%) scaleX(0.4)" },
          "100%": { transform: "translateX(250%) scaleX(0.4)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-out": "fade-out 140ms cubic-bezier(0.4, 0, 1, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.6s infinite",
        "indeterminate-bar": "indeterminate-bar 1.4s infinite ease-in-out",
      },

      zIndex: {
        dropdown: "1000",
        sticky: "1100",
        overlay: "1200",
        modal: "1300",
        toast: "1400",
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, addComponents }) => {
      addUtilities({
        /**
         * The glass material, as one utility.
         *
         * Left to individual components this becomes four slightly different
         * blurs. `backdrop-filter` is also the single most expensive thing on
         * the page, so having one definition means one place to turn it down if
         * a low-end device struggles.
         */
        ".glass": {
          backgroundColor: "rgb(var(--aegis-glass-tint) / var(--aegis-glass-opacity))",
          backdropFilter: "blur(var(--aegis-glass-blur)) saturate(150%)",
          WebkitBackdropFilter: "blur(var(--aegis-glass-blur)) saturate(150%)",
          border: "1px solid rgb(var(--aegis-glass-border) / var(--aegis-glass-border-opacity))",
          boxShadow: "var(--aegis-glass-shadow)",
        },
        /** Hairline used along the top of glass panels to catch the light. */
        ".glass-sheen": {
          position: "relative",
        },
        ".glass-sheen::before": {
          content: '""',
          position: "absolute",
          insetInline: "0",
          top: "0",
          height: "1px",
          background:
            "linear-gradient(to right, transparent 5%, rgb(255 255 255 / 0.22) 50%, transparent 95%)",
        },
      });

      addComponents({
        /**
         * One focus treatment for the whole platform.
         *
         * Keyboard and screen-reader users navigate by focus; if each app
         * invents its own ring, the weakest one becomes an accessibility
         * defect nobody notices until an audit.
         */
        ".focus-ring": {
          outline: "2px solid transparent",
          outlineOffset: "2px",
          "&:focus-visible": {
            boxShadow: "0 0 0 2px rgb(var(--aegis-canvas)), 0 0 0 4px rgb(var(--aegis-ring))",
          },
        },
      });
    }),
  ],
} satisfies Config;

export default aegisPreset;
