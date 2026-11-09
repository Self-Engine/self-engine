import path from "node:path";
import { defineConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";
import { BASE_LANGUAGE, LANGUAGE_TAGS } from "./src/core/languages.ts";

/**
 * One catalog per language, extracted from every app and package (ADR 0011). The patterns name
 * no module, so a new package needs no change here.
 */
export default defineConfig({
  rootDir: path.resolve(import.meta.dirname, "../.."),
  sourceLocale: BASE_LANGUAGE,
  locales: [...LANGUAGE_TAGS],
  fallbackLocales: { default: BASE_LANGUAGE },
  catalogs: [
    {
      path: "<rootDir>/packages/i18n/src/locales/{locale}",
      // Down to the files: Lingui expands only a literal directory, not a pattern that matches one.
      include: ["<rootDir>/apps/*/src/**/*.{ts,tsx}", "<rootDir>/packages/*/src/**/*.{ts,tsx}"],
      // Absolute like `include`: Lingui matches relative excludes against the working directory.
      // A story's sample text is plain English that no user ever sees.
      exclude: [
        "<rootDir>/**/node_modules/**",
        "<rootDir>/**/*.test.*",
        "<rootDir>/**/*.stories.*",
        "<rootDir>/**/*.d.ts",
      ],
    },
  ],
  // Line numbers would change with every edit elsewhere in a file.
  format: formatter({ lineNumbers: false }),
});
