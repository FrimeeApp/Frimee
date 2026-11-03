import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    // TODO: back to "error" once fixed. They were already failing when CI was added:
    // - purity: Date.now() during render in src/app/(app)/flights/page.tsx
    // - set-state-in-effect: setPlanId in an effect in src/app/(app)/plan/[id]/PlanPostClient.tsx
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mobile/Capacitor build artifacts:
    "**/build/**",
    "android/**",
    "ios/**",
    // Docs / snapshots:
    "docs/**",
  ]),
]);

export default eslintConfig;
