import { defineConfig } from "vite-plus";

// Reference material, not part of the workspace (see prototypes/*/RESULTS.md).
const IGNORED = ["prototypes/**", "**/dist/**", "**/node_modules/**", "pnpm-lock.yaml"];

export default defineConfig({
  test: {
    include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    allowOnly: !process.env.CI,
    // Flaky tests are fixed, not retried.
    retry: 0,
  },
  lint: {
    ignorePatterns: IGNORED,
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    // German planning history (D46). Oxfmt rewraps its lists and changes their meaning.
    ignorePatterns: [...IGNORED, "docs/plan/**"],
    sortPackageJson: {},
  },
});
