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
      // Type check only, through tsgolint. Not plain `tsc`: TypeScript 7 is a native Go
      // binary whose file reads Vite Task's tracking does not see, so a cached `tsc` task
      // replayed `ok` after new type errors.
      "verify:typecheck": "vp check --no-fmt --no-lint",
      "verify:adrs": "node scripts/check-adrs.ts",
      "verify:test": "vp test run --reporter=agent",
    },
  },
});
