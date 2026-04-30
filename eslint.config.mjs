import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // We deliberately read localStorage / window state inside one-shot mount effects
      // to hydrate client-only state. React 19's new rule flags this; it does not break
      // hydration in our case because these reads happen post-mount only.
      "react-hooks/set-state-in-effect": "off",
      // Allow apostrophes etc. in JSX prose copy.
      "react/no-unescaped-entities": "off",
      // Empty interfaces are fine for documenting future-extension shapes.
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
