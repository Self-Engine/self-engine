// The `stories` stage of `pnpm verify`: every story rendered in Chromium (ADR 0012). A file of
// its own, and not `vite.config.ts`, because Storybook would load that one into its dev server.

import { resolve } from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  plugins: [storybookTest({ configDir: resolve(import.meta.dirname, ".storybook") })],
  test: {
    name: "stories",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      // A red story already names its error. Screenshots would land beside the stories.
      screenshotFailures: false,
    },
  },
});
