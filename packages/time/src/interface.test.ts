import { expect, expectTypeOf, test } from "vite-plus/test";
import * as time from "./index.ts";
import type { CalendarDay, DaySpan, Duration, FirstDayOfWeek, Instant } from "./index.ts";

test("the public functions use only package values and require all arguments", () => {
  expectTypeOf(time.addDays).toEqualTypeOf<(day: CalendarDay, amount: number) => CalendarDay>();
  expectTypeOf(time.addMonths).toEqualTypeOf<(day: CalendarDay, amount: number) => CalendarDay>();
  expectTypeOf(time.daysBetween).toEqualTypeOf<(from: CalendarDay, to: CalendarDay) => number>();
  expectTypeOf(time.weekOf).toEqualTypeOf<
    (day: CalendarDay, firstDayOfWeek: FirstDayOfWeek) => DaySpan
  >();
  expectTypeOf(time.isoWeekNumber).toEqualTypeOf<(day: CalendarDay) => number>();
  expectTypeOf(time.durationBetween).toEqualTypeOf<(from: Instant, to: Instant) => Duration>();
  expectTypeOf(time.epochMsOf).toEqualTypeOf<(instant: Instant) => number>();
  expectTypeOf(time.instantFromDate).toEqualTypeOf<(date: Date) => Instant>();
  expect(Object.keys(time).sort()).toEqual(
    [
      "addDays",
      "addMonths",
      "calendarDaySchema",
      "daySpanSchema",
      "daysBetween",
      "durationBetween",
      "durationSchema",
      "epochMsOf",
      "instantFromDate",
      "instantSchema",
      "isoWeekNumber",
      "wallClockTimeSchema",
      "weekOf",
    ].sort(),
  );
});
