import globals from "globals";
import base from "./base.js";

/** The server-side layer: Node globals, no DOM. */
export default [
  ...base,
  {
    files: ["**/*.{ts,js,mjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
