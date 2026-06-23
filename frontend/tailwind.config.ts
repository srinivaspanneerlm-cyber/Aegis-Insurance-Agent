import type { Config } from "tailwindcss";

const config: Config = {
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
      boxShadow: {
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
