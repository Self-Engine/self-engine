import type { Clock } from "./clock.ts";
import type { Instant } from "./instant.ts";
import { calendarDayFrom, instantFrom } from "./supported-years.ts";
import {
  wallClockTimeSchema,
  type CalendarDay,
  type DaySpan,
  type WallClockTime,
} from "./values.ts";
import type { TimeZone } from "./zone.ts";

/** Which Instant a day and wall-clock time mean in a zone, and how a clock change shaped it. */
export type ResolvedInstant =
  /** The time exists once. */
  | { readonly case: "unambiguous"; readonly instant: Instant }
  /** The clocks jumped over the time; `instant` lies the length of the gap after it. */
  | { readonly case: "skipped"; readonly instant: Instant }
  /** The clocks went back over the time; `instant` is the first occurrence, `later` the second. */
  | { readonly case: "repeated"; readonly instant: Instant; readonly later: Instant };

/** Half-open: from `start` up to, and excluding, `end`. */
export interface InstantRange {
  readonly start: Instant;
  readonly end: Instant;
}

function zonedOf(instant: Instant, timeZone: TimeZone): Temporal.ZonedDateTime {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
}

/** The calendar day an Instant falls on in a zone. */
export function calendarDayOf(instant: Instant, timeZone: TimeZone): CalendarDay {
  return calendarDayFrom(zonedOf(instant, timeZone).toPlainDate());
}

/** The wall-clock time an Instant shows in a zone, cut to the minute. */
export function wallClockTimeOf(instant: Instant, timeZone: TimeZone): WallClockTime {
  const plainTime = zonedOf(instant, timeZone).toPlainTime();
  return wallClockTimeSchema.parse(
    plainTime.toString({ smallestUnit: "minute", roundingMode: "trunc" }),
  );
}

/**
 * The Instant of a day and wall-clock time in a zone. A skipped time moves on by the length of
 * the gap; a repeated time yields its earlier Instant and also names the later one.
 */
export function instantAt(
  day: CalendarDay,
  time: WallClockTime,
  timeZone: TimeZone,
): ResolvedInstant {
  const local = Temporal.PlainDateTime.from(`${day}T${time}`);
  const earlier = local.toZonedDateTime(timeZone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(timeZone, { disambiguation: "later" });
  if (earlier.epochNanoseconds === later.epochNanoseconds)
    return { case: "unambiguous", instant: instantFrom(earlier.toInstant()) };
  if (!earlier.toPlainDateTime().equals(local))
    return { case: "skipped", instant: instantFrom(later.toInstant()) };
  return {
    case: "repeated",
    instant: instantFrom(earlier.toInstant()),
    later: instantFrom(later.toInstant()),
  };
}

/** The first moment of a day in a zone; not always 00:00. */
export function startOfCalendarDay(day: CalendarDay, timeZone: TimeZone): Instant {
  return instantFrom(Temporal.PlainDate.from(day).toZonedDateTime(timeZone).toInstant());
}

/** The Instants of a calendar day or day span: its first moment up to the next day's first. */
export function instantRangeOf(days: CalendarDay | DaySpan, timeZone: TimeZone): InstantRange {
  const [first, last] = typeof days === "string" ? [days, days] : [days.first, days.last];
  const dayAfter = Temporal.PlainDate.from(last).add({ days: 1 });
  return {
    start: startOfCalendarDay(first, timeZone),
    end: instantFrom(dayAfter.toZonedDateTime(timeZone).toInstant()),
  };
}

/** The calendar day it is now in a zone, by the given clock. */
export function today(clock: Clock, timeZone: TimeZone): CalendarDay {
  return calendarDayOf(clock(), timeZone);
}
