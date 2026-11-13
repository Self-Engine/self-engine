import { expect, test } from "vite-plus/test";
import { checkRuntime } from "./program.ts";

test("the runtime passes the shared cases, the Intl comparison and the day continuity", () => {
  const result = checkRuntime();
  expect(result.failures).toEqual([]);
  expect(result.cases).toBeGreaterThan(0);
  expect(result.transitions).toBeGreaterThan(0);
  expect(result.comparisons).toBeGreaterThan(result.transitions);
  expect(result.dayContinuityChanges).toBeGreaterThan(0);
}, 30_000);
