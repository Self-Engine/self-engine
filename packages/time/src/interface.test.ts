import { expect, expectTypeOf, test } from "vite-plus/test";
import * as time from "./index.ts";
import type {
  CalendarDay,
  CalendarDayFormat,
  Clock,
  DaySpan,
  Duration,
  DurationFormat,
  FirstDayOfWeek,
  Instant,
  InstantFormat,
  InstantRange,
  ResolvedInstant,
  ResolvedTimeZone,
  TimeZone,
  WallClockTime,
  WallClockTimeResolution,
} from "./index.ts";

test("the public functions use only package values and require all arguments", () => {
  expectTypeOf(time.addDays).toEqualTypeOf<(day: CalendarDay, amount: number) => CalendarDay>();
  expectTypeOf(time.addMonths).toEqualTypeOf<(day: CalendarDay, amount: number) => CalendarDay>();
  expectTypeOf(time.daysBetween).toEqualTypeOf<(from: CalendarDay, to: CalendarDay) => number>();
  expectTypeOf(time.weekOf).toEqualTypeOf<
    (day: CalendarDay, firstDayOfWeek: FirstDayOfWeek) => DaySpan
  >();
  expectTypeOf(time.mantineFirstDayOfWeek).toEqualTypeOf<
    (firstDayOfWeek: FirstDayOfWeek) => 0 | 1 | 2 | 3 | 4 | 5 | 6
  >();
  expectTypeOf(time.firstDayOfWeekForRegion).toEqualTypeOf<
    (region: "de-DE" | "en-US") => FirstDayOfWeek
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
  expectTypeOf(time.resolveWallClockTime).toEqualTypeOf<
    (
      day: CalendarDay,
      time: WallClockTime,
      timeZone: TimeZone,
      options?: { readonly previous?: Instant; readonly lowerBound?: Instant },
    ) => WallClockTimeResolution
  >();
  expectTypeOf<WallClockTimeResolution>().toEqualTypeOf<
    | { readonly case: "unambiguous"; readonly instant: Instant }
    | { readonly case: "skipped" }
    | {
        readonly case: "repeated";
        readonly instant: Instant;
        readonly occurrence: "earlier" | "later";
        readonly offset: string;
      }
  >();
  expectTypeOf(time.startOfCalendarDay).toEqualTypeOf<
    (day: CalendarDay, timeZone: TimeZone) => Instant
  >();
  expectTypeOf(time.instantRangeOf).toEqualTypeOf<
    (days: CalendarDay | DaySpan, timeZone: TimeZone) => InstantRange
  >();
  expectTypeOf(time.today).toEqualTypeOf<(clock: Clock, timeZone: TimeZone) => CalendarDay>();
  expectTypeOf(time.formatInstant).toEqualTypeOf<
    (instant: Instant, format: InstantFormat, locale: string, timeZone: TimeZone) => string
  >();
  expectTypeOf<InstantFormat>().toEqualTypeOf<"dateTime">();
  expectTypeOf(time.formatDuration).toEqualTypeOf<
    (duration: Duration, format: DurationFormat, locale: string) => string
  >();
  expectTypeOf<DurationFormat>().toEqualTypeOf<"hoursMinutes" | "hoursMinutesSeconds">();
  expectTypeOf(time.formatCalendarDay).toEqualTypeOf<
    (day: CalendarDay, format: CalendarDayFormat, locale: string) => string
  >();
  expectTypeOf<CalendarDayFormat>().toEqualTypeOf<"weekdayDate" | "shortDate">();
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
      "resolveWallClockTime",
      "sameTimeZone",
      "startOfCalendarDay",
      "today",
      "wallClockTimeOf",
      "daySpanSchema",
      "daysBetween",
      "durationBetween",
      "durationSchema",
      "epochMsOf",
      "formatCalendarDay",
      "formatDuration",
      "formatInstant",
      "firstDayOfWeekForRegion",
      "instantFromDate",
      "instantSchema",
      "isoWeekNumber",
      "mantineFirstDayOfWeek",
      "wallClockTimeSchema",
      "weekOf",
    ].sort(),
  );
});
