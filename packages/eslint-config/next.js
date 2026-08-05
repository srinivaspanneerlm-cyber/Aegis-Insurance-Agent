import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import base from "./base.js";

/**
 * Adds the React and browser layer for the Next.js apps.
 *
 * The hooks rules are errors, not warnings. A dependency array that lies is not
 * a style problem — it is a stale render or a listener that never rebinds, and
 * both surface as "the page sometimes doesn't update", which is the most
 * expensive class of bug to chase.
 */
export default [
  ...base,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",

      // The new JSX transform makes both of these obsolete.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",

      "react/jsx-key": "error",
      "react/no-array-index-key": "warn",
      "react/self-closing-comp": "error",
    },
  },
];
