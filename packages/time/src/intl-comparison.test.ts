import { expect, test } from "vite-plus/test";
import { compareWithIntl } from "./check/intl-comparison.ts";

test("time agrees with Intl at every clock change of every zone from 1970 to 2040", () => {
  const { transitions, comparisons, mismatches } = compareWithIntl();
  expect(mismatches).toEqual([]);
  expect(transitions).toBeGreaterThan(0);
  expect(comparisons).toBeGreaterThan(transitions);
  // About 1.4 s alone; the margin keeps it green when the gate runs every stage at once.
}, 30_000);
