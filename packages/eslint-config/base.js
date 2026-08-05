import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * The rules every package in the monorepo shares.
 *
 * Kept small on purpose. A long rule list is mostly a list of arguments the
 * team will have again in review; these are the ones that catch defects rather
 * than settle taste. Formatting is not here at all — Prettier owns that, and
 * `eslint-config-prettier` switches off anything that would fight it.
 */
export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `any` erases the guarantees the rest of this config exists to provide.
      // A warning rather than an error so an in-progress refactor is not
      // blocked at the commit hook — CI treats warnings as failures.
      "@typescript-eslint/no-explicit-any": "warn",

      // An unused variable is usually a half-finished edit. `_` prefixed ones
      // are the deliberate exception (unused route params, discarded tuple
      // members).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Type-only imports must say so. Without this, a type import survives
      // into the emitted JS and drags a whole module into the bundle for
      // nothing.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // `==` across types is a source of quiet bugs; `null` is the one case
      // where loose equality says exactly what is meant.
      eqeqeq: ["error", "always", { null: "ignore" }],

      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-implicit-coercion": "error",
      "prefer-const": ["error", { destructuring: "all" }],
    },
  },
  prettier
);
