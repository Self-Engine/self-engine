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
  run: {
    // The stages of `pnpm verify` (scripts/verify.ts), cached by Vite Task: a stage whose
    // inputs did not change replays its last output instead of running again.
    tasks: {
      "verify:format": "vp fmt",
      // Type-aware lint; with `typeCheck` it also reports compiler errors.
      "verify:lint": "vp lint --deny-warnings",
      "verify:typecheck": "tsc --noEmit",
      "verify:adrs": "node scripts/check-adrs.ts",
      "verify:test": "vp test run --reporter=agent",
    },
  },
});
