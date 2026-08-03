import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Vitest configuration for the frontend.
 *
 * - jsdom environment so React component/hook tests can render.
 * - `@/…` alias mirrors the Next.js/tsconfig path mapping.
 * - Loads jest-dom matchers via the setup file.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // The default 5s is too tight for the Framer Motion component suites. They
    // pass in well under a second on an idle machine, but vitest runs files
    // across one worker per core, and once the box is saturated — a dev server
    // alongside, or a busy CI runner — a render that normally takes 200ms can
    // cross 5s and fail on time rather than on behaviour. That produced a
    // different two or three "failures" on every run, all of them green in
    // isolation. A longer ceiling costs nothing when tests pass and removes the
    // false alarms; a genuinely hung test still fails, just later.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
