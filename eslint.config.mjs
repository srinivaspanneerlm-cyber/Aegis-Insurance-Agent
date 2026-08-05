import next from "@aegis/eslint-config/next";

/**
 * The config ESLint finds when it runs from the repository root.
 *
 * Two places do that: the pre-commit hook, because lint-staged hands ESLint
 * absolute paths from wherever the commit was made, and most editors. Flat
 * config does not cascade into subdirectories the way `.eslintrc` did, so
 * without this file those two cases fail outright with "couldn't find an
 * eslint.config.js" — which is exactly how this file came to exist, on the
 * first commit that staged monorepo sources.
 *
 * Each workspace package keeps its own config too; that is what `pnpm -r lint`
 * uses, because those runs happen inside the package. Both derive from
 * `@aegis/eslint-config`, so the two can only agree.
 *
 * The React layer is applied across the whole monorepo rather than being
 * carved out for `apps/` and `packages/ui`. The rules are inert on files with
 * no components in them, and a precise carve-out here would be a second, more
 * fragile description of a boundary the workspace layout already states.
 *
 * The existing applications are excluded deliberately. `frontend/` and
 * `backend/` are on ESLint 8 with their own configs; linting them from here
 * would report against rules they were never written to satisfy.
 */
export default [
  {
    ignores: [
      "frontend/**",
      "backend/**",
      "ai-python/**",
      "Aegis-AI/**",
      "presentation/**",
      "nginx/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",

      // Written by Next on every build, gitignored, and it trips
      // `triple-slash-reference` — a rule about code we author, not code a
      // framework regenerates underneath us.
      "**/next-env.d.ts",
    ],
  },
  ...next,
];
