// The `stories` stage of `pnpm verify`: every story rendered in Chromium (ADR 0012). A file of
// its own, and not `vite.config.ts`, because Storybook would load that one into its dev server.

import { resolve } from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  plugins: [storybookTest({ configDir: resolve(import.meta.dirname, ".storybook") })],
  // Vite trusts a dependency cache whose lockfile and config are unchanged, even when a story has
  // since gained an import. It then bundles that import mid-run and reloads the running stories,
  // which fail while importing their setup file. Forcing the scan reads the current stories.
  optimizeDeps: { force: true },
  test: {
    name: "stories",
    // Before Storybook's own setup file loads React: the render-count gate reads the commits (D256).
    setupFiles: [resolve(import.meta.dirname, ".storybook/render-counter.ts")],
    browser: {
      enabled: true,
      headless: true,
      // A browser that prefers dark: a story that followed the system would go red here.
      provider: playwright({ contextOptions: { colorScheme: "dark" } }),
      instances: [{ browser: "chromium" }],
      // A red story already names its error. Screenshots would land beside the stories.
      screenshotFailures: false,
    },
  },
});
