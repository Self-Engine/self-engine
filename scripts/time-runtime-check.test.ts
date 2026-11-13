import { expect, test } from "vite-plus/test";
import { runtimeCheckMessage } from "./time-runtime-check.ts";

test("a successful runtime check reports the process and work performed", () => {
  expect(
    runtimeCheckMessage("page", {
      cases: 87,
      transitions: 20,
      comparisons: 100,
      dayContinuityChanges: 12,
      failures: [],
    }),
  ).toBe(
    "Time check page: PASS (87 cases, 20 transitions, 100 comparisons, 12 clock changes with continuous days)",
  );
});

test.each(["utilityProcess", "page"])("%s fails with every named discrepancy", (runtime) => {
  expect(() =>
    runtimeCheckMessage(runtime, {
      cases: 87,
      transitions: 20,
      comparisons: 100,
      dayContinuityChanges: 12,
      failures: [
        "Cairo starts at 01:00: expected 01:00, got 00:00",
        "resolves UTC: mismatch",
        "Berlin: Intl mismatch",
      ],
    }),
  ).toThrow(
    `Time check ${runtime}: FAIL\nCairo starts at 01:00: expected 01:00, got 00:00\nresolves UTC: mismatch\nBerlin: Intl mismatch`,
  );
});
