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
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
