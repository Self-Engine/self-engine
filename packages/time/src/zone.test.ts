import { expect, expectTypeOf, test } from "vite-plus/test";
import { outcome } from "./check/cases.ts";
import { zoneNameCases } from "./check/zone-names.ts";
import { deviceTimeZone, resolveTimeZone, sameTimeZone, type TimeZone } from "./index.ts";

test.each(zoneNameCases)("$name", ({ actual, expected }) => {
  expect(outcome(actual)).toEqual(expected);
});

test("the device's zone is the zone the process runs in", () => {
  expect(sameTimeZone(deviceTimeZone(), resolveTimeZone(process.env.TZ!).timeZone)).toBe(true);
});

test("a plain string is no TimeZone", () => {
  expectTypeOf<string>().not.toExtend<TimeZone>();
  expectTypeOf(resolveTimeZone("UTC").timeZone).toEqualTypeOf<TimeZone>();
});
