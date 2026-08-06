import type { Config } from "tailwindcss";
import { aegisPreset } from "@aegis/design-system/preset";

/**
 * The app owns its content globs; the preset owns every token.
 *
 * The second glob matters: Tailwind only emits classes it can see in source, and
 * the shared components live outside this app's tree. Without it, everything
 * from `@aegis/ui` renders unstyled — the classic silent monorepo failure.
 */
export default {
  presets: [aegisPreset],
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/intelligence/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
