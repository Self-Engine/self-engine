import { expect, test } from "vite-plus/test";
import { epochMsOf, instantFromDate, instantSchema } from "./index.ts";

test.each([
  ["1970-01-01T00:00:00.000Z", 0],
  ["1969-12-31T23:59:59.999Z", -1],
  ["2026-11-14T00:00:00.297Z", 1794614400297],
  ["1000-01-01T00:00:00.000Z", -30610224000000],
  ["9999-12-31T23:59:59.999Z", 253402300799999],
] as const)("epoch milliseconds of %s", (text, expected) => {
  expect(epochMsOf(instantSchema.parse(text))).toBe(expected);
});
test.each(["1000-01-01T00:00:00.000Z", "2026-11-14T07:30:27.297Z", "9999-12-31T23:59:59.999Z"])(
  "converts a foreign Date to canonical Instant %s",
  (text) => {
    expect(instantFromDate(new Date(text))).toBe(text);
  },
);
test.each([
  new Date(NaN),
  new Date("0999-12-31T23:59:59.999Z"),
  new Date("+010000-01-01T00:00:00.000Z"),
])("rejects invalid or out-of-range foreign Date %s", (date) => {
  expect(() => instantFromDate(date)).toThrow(RangeError);
});
