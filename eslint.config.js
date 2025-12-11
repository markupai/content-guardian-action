// @ts-check

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["eslint.config.js", "jest.config.js", "rollup.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ["coverage", "dist"],
  },
];
