import { defineConfig } from "vite-plus";
import { testTimeZone } from "./scripts/testing/process-timezone.ts";

// Reference material, not part of the workspace (see prototypes/*/RESULTS.md).
const IGNORED = ["prototypes/**", "**/dist/**", "**/node_modules/**", "pnpm-lock.yaml"];

// Workers inherit the zone from this process (scripts/testing/process-timezone.ts).
process.env.TZ = testTimeZone();

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
    // The repo's own rules (packages/oxlint-plugin), reported as `self-engine/<rule>`.
    jsPlugins: [{ name: "self-engine", specifier: "@self-engine/oxlint-plugin" }],
    rules: {
      // dependency-cruiser cannot see `import("…")` types (.dependency-cruiser.ts).
      "self-engine/no-import-type-query": "error",
      "self-engine/no-silent-catch": "error",
    },
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
      // The format stage under CI (scripts/verify.ts): fails on unformatted files instead of
      // rewriting them. A task of its own, so its cache never replays a write run's result.
      "verify:format:check": "vp fmt --check",
      // Type-aware lint; with `typeCheck` it also reports compiler errors.
      "verify:lint": "vp lint --deny-warnings",
      // Type check only, through tsgolint. Not plain `tsc`: TypeScript 7 is a native Go
      // binary whose file reads Vite Task's tracking does not see, so a cached `tsc` task
      // replayed `ok` after new type errors.
      "verify:typecheck": "vp check --no-fmt --no-lint",
      // Module boundaries (ADR 0006), rules in .dependency-cruiser.ts.
      "verify:boundaries":
        "depcruise apps packages scripts vite.config.ts .dependency-cruiser.ts --config .dependency-cruiser.ts",
      "verify:adrs": "node scripts/check-adrs.ts",
      "verify:test": "vp test run --reporter=agent",
    },
  },
});
