import type { Clock } from "./clock.ts";
import { epochMsOf } from "./borders.ts";
import type { Instant } from "./instant.ts";
import { instantFrom } from "./supported-years.ts";
import {
  wallClockTimeSchema,
  type CalendarDay,
  type DaySpan,
  type WallClockTime,
} from "./values.ts";
import type { TimeZone } from "./zone.ts";
import { calendarDayOf, startOfCalendarDay, zonedOf } from "./zoned-day.ts";

export { calendarDayOf, startOfCalendarDay };

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

/** The wall-clock time an Instant shows in a zone, cut to the minute. */
export function wallClockTimeOf(instant: Instant, timeZone: TimeZone): WallClockTime {
  const plainTime = zonedOf(instant, timeZone).toPlainTime();
  return wallClockTimeSchema.parse(
    plainTime.toString({ smallestUnit: "minute", roundingMode: "trunc" }),
  );
}

type ZonedCandidates =
  | { case: "unambiguous"; zoned: Temporal.ZonedDateTime }
  | { case: "skipped"; zoned: Temporal.ZonedDateTime }
  | { case: "repeated"; earlier: Temporal.ZonedDateTime; later: Temporal.ZonedDateTime };

function zonedCandidates(
  day: CalendarDay,
  time: WallClockTime,
  timeZone: TimeZone,
): ZonedCandidates {
  const local = Temporal.PlainDateTime.from(`${day}T${time}`);
  const earlier = local.toZonedDateTime(timeZone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(timeZone, { disambiguation: "later" });
  if (earlier.epochNanoseconds === later.epochNanoseconds)
    return { case: "unambiguous", zoned: earlier };
  if (!earlier.toPlainDateTime().equals(local)) return { case: "skipped", zoned: later };
  return { case: "repeated", earlier, later };
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
  const candidates = zonedCandidates(day, time, timeZone);
  if (candidates.case !== "repeated")
    return { case: candidates.case, instant: instantFrom(candidates.zoned.toInstant()) };
  return {
    case: "repeated",
    instant: instantFrom(candidates.earlier.toInstant()),
    later: instantFrom(candidates.later.toInstant()),
  };
}

type Occurrence = "earlier" | "later";

/** The Instant a form should use, with the chosen occurrence and UTC offset when repeated. */
export type WallClockTimeResolution =
  | { readonly case: "unambiguous"; readonly instant: Instant }
  | { readonly case: "skipped" }
  | {
      readonly case: "repeated";
      readonly instant: Instant;
      readonly occurrence: Occurrence;
      /** Signed ISO offset, such as `+01:00` or `-03:30`, including seconds when present. */
      readonly offset: string;
    };

function nearestOccurrence(
  earlier: Temporal.ZonedDateTime,
  later: Temporal.ZonedDateTime,
  previous: Instant,
): Occurrence {
  const previousInstant = Temporal.Instant.from(previous);
  const previousMs = previousInstant.epochMilliseconds;
  const earlierDistance = Math.abs(earlier.epochMilliseconds - previousMs);
  const laterDistance = Math.abs(later.epochMilliseconds - previousMs);
  if (earlierDistance !== laterDistance)
    return earlierDistance < laterDistance ? "earlier" : "later";

  // On a tie, stay in the previous occurrence. An unmatched offset defaults to the earlier one.
  const previousOffset = previousInstant.toZonedDateTimeISO(later.timeZoneId).offsetNanoseconds;
  return previousOffset === later.offsetNanoseconds ? "later" : "earlier";
}

/**
 * Resolve a form value without moving a skipped time. On an edit, the previous Instant takes
 * precedence. For a new repeated value, use the earlier occurrence unless it is at or before
 * the lower bound. The caller still validates the resulting range.
 */
export function resolveWallClockTime(
  day: CalendarDay,
  time: WallClockTime,
  timeZone: TimeZone,
  { previous, lowerBound }: { readonly previous?: Instant; readonly lowerBound?: Instant } = {},
): WallClockTimeResolution {
  const candidates = zonedCandidates(day, time, timeZone);
  if (candidates.case === "skipped") return { case: "skipped" };
  if (candidates.case === "unambiguous")
    return { case: "unambiguous", instant: instantFrom(candidates.zoned.toInstant()) };
  const occurrence =
    previous !== undefined
      ? nearestOccurrence(candidates.earlier, candidates.later, previous)
      : lowerBound !== undefined && candidates.earlier.epochMilliseconds <= epochMsOf(lowerBound)
        ? "later"
        : "earlier";
  const chosen = candidates[occurrence];
  return {
    case: "repeated",
    instant: instantFrom(chosen.toInstant()),
    occurrence,
    offset: chosen.offset,
  };
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
