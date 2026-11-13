import { expect, test } from "vite-plus/test";
import { outcome } from "./check/cases.ts";
import { fixedCases } from "./check/fixed-cases.ts";

test.each(fixedCases)("$name", ({ actual, expected }) => {
  expect(outcome(actual)).toEqual(expected);
});
