// ESLint 9 flat config for the whole monorepo (client + server).
// Later entries override earlier ones for the files they match.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";
import n from "eslint-plugin-n";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import globals from "globals";

// Unused variables are errors, except names starting with "_" (an intentional "I know").
const unusedVars = [
  "error",
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
];

// Import patterns that break the server layering (docs/adr/0002-layering.md).
const noModels = {
  group: ["**/models", "**/models/**"],
  message: "Only services may import models (ADR 0002). Call a service instead.",
};
const noMongoose = {
  name: "mongoose",
  message: "Only models, services and config/db.js may use Mongoose (ADR 0002).",
};

// Node built-ins that do file, network or process I/O; banned in utils/. Both spellings
// ("fs" and "node:fs") are listed because no-restricted-imports matches the exact string.
const impureNodeModules = ["fs", "fs/promises", "http", "https", "net", "child_process"].flatMap(
  (name) => [name, `node:${name}`],
);

export default defineConfig([
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/coverage/",
    "**/playwright-report/",
    "**/test-results/",
  ]),

  // Every JS file: ESLint's recommended rules.
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-unused-vars": unusedVars },
  },

  // Client (React in the browser).
  {
    files: ["client/**/*.{js,jsx}"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"], // React 17+ JSX transform: no "import React" needed
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: "detect" } },
    rules: {
      // Plain JavaScript project with no prop-types package; props are documented with JSDoc instead.
      "react/prop-types": "off",
    },
  },

  // shadcn/ui components are generated code: they export variants (e.g. buttonVariants) next to
  // components, which is fine for us even though it costs a full reload on edit.
  {
    files: ["client/src/components/ui/**/*.{js,jsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },

  // Server (Node 22, ES modules).
  {
    files: ["server/**/*.js"],
    extends: [n.configs["flat/recommended-module"]],
    languageOptions: { globals: { ...globals.node } },
  },

  // ADR 0002: controllers, middleware and jobs never touch Mongoose or models.
  {
    files: [
      "server/src/controllers/**/*.js",
      "server/src/middleware/**/*.js",
      "server/src/jobs/**/*.js",
    ],
    rules: {
      "no-restricted-imports": ["error", { paths: [noMongoose], patterns: [noModels] }],
    },
  },

  // ADR 0002: utils are pure. No database, config/env, network or file access.
  {
    files: ["server/src/utils/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            noMongoose,
            ...impureNodeModules.map((name) => ({
              name,
              message: "utils/ must stay pure (ADR 0002).",
            })),
          ],
          patterns: [
            noModels,
            {
              group: ["**/config", "**/config/**"],
              message: "utils/ must stay pure: pass config values in as arguments (ADR 0002).",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "utils/ must stay pure: pass values in as arguments.",
        },
      ],
    },
  },

  // Tooling config files (vite.config.js, vitest config, this file) run in Node.
  {
    files: ["*.{js,mjs,cjs}", "client/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Client tests run in Node with jsdom, so both sets of globals exist. Vitest APIs are imported.
  {
    files: ["client/**/*.test.{js,jsx}", "client/src/test/**/*.{js,jsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // Must stay last: turns off every rule that would fight Prettier's formatting.
  prettier,
]);
