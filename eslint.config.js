import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "server/hugo-engine/standalone.js",
      "server/video-processor.js",
      "server/production-server.js",
      "scripts/**",
      "src/scripts/**",
      "src/supabase/functions/**",
    ],
  },
  {
    rules: {
      // Relaxed for existing codebase — tighten over time
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "no-useless-assignment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "preserve-caught-error": "off",
      "prefer-const": "warn",
    },
  }
);
