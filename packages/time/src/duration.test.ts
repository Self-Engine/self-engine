import { expect, expectTypeOf, test } from "vite-plus/test";
import { durationBetween, instantSchema, type Duration } from "./index.ts";
const instant = (value: string) => instantSchema.parse(value);

test.each([
  ["2026-11-14T07:30:00.900Z", "2026-11-14T07:30:01.100Z", 1],
  ["2026-11-14T07:30:00.100Z", "2026-11-14T07:30:00.900Z", 0],
  ["1969-12-31T23:59:59.900Z", "1970-01-01T00:00:00.100Z", 1],
  ["2026-11-14T07:30:00.000Z", "2026-11-14T07:30:40.000Z", 40],
  ["2026-11-14T07:30:00.100Z", "2026-11-14T07:30:00.100Z", 0],
  ["1000-01-01T00:00:00.000Z", "9999-12-31T23:59:59.999Z", 284012524799],
] as const)("duration from %s to %s is %s whole seconds", (from, to, expected) => {
  const result = durationBetween(instant(from), instant(to));
  expect(result).toBe(expected);
  expectTypeOf(result).toEqualTypeOf<Duration>();
});
test.each(["2026-11-14T07:30:00.100Z", "2026-11-14T07:29:59.999Z"])(
  "rejects an earlier end, even within the same second %s",
  (to) => {
    expect(() => durationBetween(instant("2026-11-14T07:30:00.900Z"), instant(to))).toThrow(
      RangeError,
    );
  },
);
