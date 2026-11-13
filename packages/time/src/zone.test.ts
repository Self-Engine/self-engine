import { expect, expectTypeOf, test } from "vite-plus/test";
import { outcome } from "./check/cases.ts";
import { zoneNameCases } from "./check/zone-names.ts";
import { deviceTimeZone, resolveTimeZone, sameTimeZone, type TimeZone } from "./index.ts";

test.each(zoneNameCases)("$name", ({ actual, expected }) => {
  expect(outcome(actual)).toEqual(expected);
});

test("the device's zone is the zone Intl reports for the process", () => {
  const reported = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  expect(sameTimeZone(deviceTimeZone(), resolveTimeZone(reported).timeZone)).toBe(true);
});

test("a plain string is no TimeZone", () => {
  expectTypeOf<string>().not.toExtend<TimeZone>();
  expectTypeOf(resolveTimeZone("UTC").timeZone).toEqualTypeOf<TimeZone>();
});
