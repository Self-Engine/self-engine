import { expect, expectTypeOf, test } from "vite-plus/test";
import {
  calendarDaySchema,
  wallClockTimeSchema,
  daySpanSchema,
  durationSchema,
  type CalendarDay,
  type WallClockTime,
  type DaySpan,
  type Duration,
} from "./index.ts";

test.each(["1000-01-01", "9999-12-31", "2000-02-29"])("accepts stored calendar day %s", (value) => {
  expect(calendarDaySchema.parse(value)).toBe(value);
});
test.each([
  "0999-12-31",
  "10000-01-01",
  "2026-02-29",
  "1900-02-29",
  "2026-04-31",
  "2026-1-01",
  "2026-01-01T00:00:00.000Z",
  "2026-01-01\n",
  null,
  20260101,
])("rejects calendar day %s", (value) => {
  expect(calendarDaySchema.safeParse(value).success).toBe(false);
});
test("brands calendar days", () => {
  expectTypeOf(calendarDaySchema.parse("2026-01-01")).toEqualTypeOf<CalendarDay>();
  expectTypeOf<string>().not.toExtend<CalendarDay>();
});
test.each(["00:00", "14:30", "23:59"])("accepts stored wall-clock time %s", (value) => {
  expect(wallClockTimeSchema.parse(value)).toBe(value);
  expectTypeOf(wallClockTimeSchema.parse(value)).toEqualTypeOf<WallClockTime>();
  expectTypeOf<string>().not.toExtend<WallClockTime>();
});
test.each(["14:30:00", "24:00", "12:60", "9:00", "14:30Z", "14:30\n", null, 1430])(
  "rejects wall-clock time %s",
  (value) => {
    expect(wallClockTimeSchema.safeParse(value).success).toBe(false);
  },
);
test.each([
  { first: "2026-11-01", last: "2026-11-30" },
  { first: "1000-01-01", last: "9999-12-31" },
  { first: "2024-02-29", last: "2024-02-29" },
])("accepts an inclusive day span %j", (value) => {
  expect(daySpanSchema.parse(value)).toEqual(value);
  expectTypeOf(daySpanSchema.parse(value)).toEqualTypeOf<DaySpan>();
  expectTypeOf<{ first: CalendarDay; last: CalendarDay }>().not.toExtend<DaySpan>();
});
test.each([
  { first: "2026-11-30", last: "2026-11-01" },
  { first: "0999-12-31", last: "2026-11-01" },
  { first: "2026-11-01", last: "2026-11-31" },
  { first: "2026-11-01" },
  null,
])("rejects invalid day span %j", (value) => {
  expect(daySpanSchema.safeParse(value).success).toBe(false);
});
test.each([0, 1, 40, 3600, Number.MAX_SAFE_INTEGER])("accepts whole seconds %s", (value) => {
  expect(durationSchema.parse(value)).toBe(value);
  expectTypeOf(durationSchema.parse(value)).toEqualTypeOf<Duration>();
  expectTypeOf<number>().not.toExtend<Duration>();
});
test.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "60", null])(
  "rejects duration %s",
  (value) => {
    expect(durationSchema.safeParse(value).success).toBe(false);
  },
);
