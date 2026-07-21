import type { Config } from "tailwindcss";

const config: Config = {
  // The ThemeContext toggles a `.dark` class on <html>; class strategy wires
  // Tailwind's `dark:` variant to that toggle (Step 4.1.2 foundation).
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // ── Semantic design tokens (Step 4.1.2) ──────────────────────────
        // Theme-switching values live as CSS variables in globals.css so a
        // single class (e.g. `bg-surface`) resolves per theme. These replace
        // the per-component `theme === "dark" ? …` ternaries in Step 4.1.3.
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-sunken": "var(--surface-sunken)",
        "surface-overlay": "var(--surface-overlay)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        content: "var(--content)",
        "content-muted": "var(--content-muted)",
        "content-subtle": "var(--content-subtle)",
        "content-inverted": "var(--content-inverted)",
        brand: "var(--brand)",
        "brand-strong": "var(--brand-strong)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",

        navy: {
          50: "#f4f6fa",
          100: "#e9edf5",
          200: "#cbd5e8",
          300: "#9db0d4",
          400: "#6986bb",
          500: "#44629e",
          600: "#324a7d",
          700: "#273a62",
          800: "#1d2946",
          900: "#0f172a", // Dark slate / deep navy
          950: "#0b0f19", // Deepest navy
        },
        royal: {
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
      // Micro rungs below Tailwind's `text-xs` (0.75rem). The app relies on
      // sub-12px labels; these name the two exact sizes it uses most so the
      // arbitrary `text-[8px]` / `text-[10px]` values can retire in 4.1.3.
      fontSize: {
        "3xs": ["0.5rem", { lineHeight: "0.75rem" }],   // 8px
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10px
      },
      // Large card radii above Tailwind's `rounded-3xl` (1.5rem), naming the
      // `rounded-[32px]` / `rounded-[36px]` values the cards already use.
      borderRadius: {
        "4xl": "2rem",    // 32px
        "5xl": "2.25rem", // 36px
      },
      boxShadow: {
        // Semantic elevation scale (Step 4.1.2). elevation-1/2 reuse the
        // existing premium shadow values so nothing shifts visually.
        "elevation-1": "0 10px 30px -10px rgba(15, 23, 42, 0.08)",
        "elevation-2": "0 20px 40px -15px rgba(15, 23, 42, 0.12)",
        "elevation-3": "0 24px 50px -12px rgba(15, 23, 42, 0.18)",
        "elevation-4": "0 32px 64px -12px rgba(15, 23, 42, 0.28)",
        'premium': '0 10px 30px -10px rgba(15, 23, 42, 0.08)',
        'premium-hover': '0 20px 40px -15px rgba(15, 23, 42, 0.12)',
        'glow-cyan': '0 0 20px -2px rgba(6, 182, 212, 0.15)',
        'glow-blue': '0 0 25px -2px rgba(37, 99, 235, 0.2)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
