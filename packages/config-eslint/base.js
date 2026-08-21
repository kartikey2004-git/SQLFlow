import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared TS rules for every package in the monorepo. */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**", "**/coverage/**"],
  },
  {
    rules: {
      // `any` shows up legitimately around JSON parsing / pg-boss job
      // payloads / express error handlers - warn rather than ban outright.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `declare global { namespace Express { ... } }` is the standard way
      // to augment Express's Request type - only ambient declarations are
      // allowed, actual runtime namespaces are still flagged.
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
);
