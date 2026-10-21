import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },
  {
    // WebKitGTK cases are page-evaluated function BODIES (top-level
    // await/return, browser globals), not modules - run.py feeds them.
    ignores: ["dist/**", "node_modules/**", "tests/webkitgtk/**"],
  },
);
