import { expect, expectTypeOf, test } from "vite-plus/test";
import * as time from "./index.ts";
import type {
  CalendarDay,
  Clock,
  DaySpan,
  Duration,
  FirstDayOfWeek,
  Instant,
  InstantRange,
  ResolvedInstant,
  ResolvedTimeZone,
  TimeZone,
  WallClockTime,
} from "./index.ts";

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
  expectTypeOf(time.resolveTimeZone).toEqualTypeOf<(name: string) => ResolvedTimeZone>();
  expectTypeOf(time.sameTimeZone).toEqualTypeOf<(a: TimeZone, b: TimeZone) => boolean>();
  expectTypeOf(time.deviceTimeZone).toEqualTypeOf<() => TimeZone>();
  expectTypeOf(time.calendarDayOf).toEqualTypeOf<
    (instant: Instant, timeZone: TimeZone) => CalendarDay
  >();
  expectTypeOf(time.wallClockTimeOf).toEqualTypeOf<
    (instant: Instant, timeZone: TimeZone) => WallClockTime
  >();
  expectTypeOf(time.instantAt).toEqualTypeOf<
    (day: CalendarDay, time: WallClockTime, timeZone: TimeZone) => ResolvedInstant
  >();
  expectTypeOf(time.startOfCalendarDay).toEqualTypeOf<
    (day: CalendarDay, timeZone: TimeZone) => Instant
  >();
  expectTypeOf(time.instantRangeOf).toEqualTypeOf<
    (days: CalendarDay | DaySpan, timeZone: TimeZone) => InstantRange
  >();
  expectTypeOf(time.today).toEqualTypeOf<(clock: Clock, timeZone: TimeZone) => CalendarDay>();
  expect(Object.keys(time).sort()).toEqual(
    [
      "addDays",
      "addMonths",
      "calendarDayOf",
      "calendarDaySchema",
      "deviceTimeZone",
      "instantAt",
      "instantRangeOf",
      "resolveTimeZone",
      "sameTimeZone",
      "startOfCalendarDay",
      "today",
      "wallClockTimeOf",
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
