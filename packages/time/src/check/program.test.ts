import { expect, test } from "vite-plus/test";
import { checkRuntime } from "./program.ts";

test("the runtime passes the shared cases and every Intl clock-change comparison", () => {
  const result = checkRuntime();
  expect(result.failures).toEqual([]);
  expect(result.cases).toBeGreaterThan(0);
  expect(result.transitions).toBeGreaterThan(0);
  expect(result.comparisons).toBeGreaterThan(result.transitions);
}, 30_000);
