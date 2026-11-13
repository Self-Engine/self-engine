import { expect, test } from "vite-plus/test";
import { checkDayContinuity } from "./check/day-continuity.ts";

test("from 2011 on, an Instant near any clock change lies inside the range of its day", () => {
  const { clockChanges, breaks } = checkDayContinuity();
  expect(breaks).toEqual([]);
  expect(clockChanges).toBeGreaterThan(0);
}, 30_000);

test("the check names the days broken by a clock that went back across midnight", () => {
  const { breaks } = checkDayContinuity(1987, 1988);
  expect(breaks).toContainEqual(expect.stringContaining("America/St_Johns"));
}, 30_000);
