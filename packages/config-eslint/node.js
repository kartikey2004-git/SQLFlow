import js from "@eslint/js";
import globals from "globals";
import base from "./base.js";

export default [
  ...base,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // node-pg-migrate migration files: plain CommonJS, not part of the TS
    // project - linted with base JS rules only, not typescript-eslint.
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
