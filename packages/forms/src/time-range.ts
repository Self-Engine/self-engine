// What the field "date, start, end" writes into its two Instants (D319, D344, D347). The field
// shows a date, a start time, an end time and, when opened, an end date; this turns what it shows
// into the two Instants of the draft. Every computation of time is a function of `time`: the day
// and wall-clock time an Instant shows, the next day, and the resolution of a clock change, whose
// rule stays there in one place.

import {
  addDays,
  type CalendarDay,
  calendarDayOf,
  epochMsOf,
  type Instant,
  repeatedTimeOffset,
  type TimeZone,
  type WallClockTime,
  wallClockTimeOf,
} from "@self-engine/time";
import { type InstantOutcome, outcomeOf } from "./instant-parts.ts";

/** What the field shows; each part may still be empty. */
export interface RangeParts {
  /** The day of the start, and of the end while no end date is opened. */
  readonly day: CalendarDay | null;
  readonly startTime: WallClockTime | null;
  readonly endTime: WallClockTime | null;
  /** Whether the end has its own date; else it lies on `day`, or on the next day ("+1"). */
  readonly endDayOpen: boolean;
  /** The opened end date; ignored while it is closed. */
  readonly endDay: CalendarDay | null;
}

/** The two Instants the draft holds, `null` where it holds none. */
export interface RangeInstants {
  readonly start: Instant | null;
  readonly end: Instant | null;
}

/**
 * Whether the parts imply "+1" before resolving a clock change: no end date is open and the
 * end time is at or before the start time.
 */
export function isNextDay(parts: RangeParts): boolean {
  const { endDayOpen, startTime, endTime } = parts;
  // `HH:MM` has a fixed width, so its text sorts as the time does.
  return !endDayOpen && startTime !== null && endTime !== null && endTime <= startTime;
}

/** The day the end lies on, as the field shows it; an end date opens on it. */
export function dayOfEnd(parts: RangeParts): CalendarDay | null {
  if (parts.endDayOpen) return parts.endDay;
  if (parts.day === null) return null;
  return isNextDay(parts) ? addDays(parts.day, 1) : parts.day;
}

/**
 * What the field shows for two Instants of the draft. The end date opens when the end lies on
 * another day than the date and "+1" would say: over several days, or on the date itself while
 * its time reads as not after the start.
 */
export function partsOf(
  start: Instant | null,
  end: Instant | null,
  timeZone: TimeZone,
): RangeParts {
  const closed: RangeParts = {
    day: start === null ? null : calendarDayOf(start, timeZone),
    startTime: start === null ? null : wallClockTimeOf(start, timeZone),
    endTime: end === null ? null : wallClockTimeOf(end, timeZone),
    endDayOpen: false,
    endDay: null,
  };
  if (end === null) return closed;
  const endDay = calendarDayOf(end, timeZone);
  return dayOfEnd(closed) === endDay ? closed : { ...closed, endDayOpen: true, endDay };
}

function instantOf(outcome: InstantOutcome, current: Instant | null): Instant | null {
  switch (outcome.case) {
    case "keep":
      return current;
    case "set":
      return outcome.instant;
    case "skipped":
      return null;
  }
}

/**
 * The two Instants for what the field shows. An Instant that still shows its date and time stays
 * with its seconds, and so does one of `original`, the Instants the field was drawn with: a value
 * passing while a time is typed may move the end to another day and back. One that still shows
 * its time on another day moves to the field's day with its seconds (`moveToDay`). Any other
 * Instant is resolved by `time` (D347, D361): on an edit (`isEdit`) with the Instant of `original`
 * as the previous value, else, also where `original` holds none, the end with the start as its
 * lower bound. The previous value is never the one the draft holds now: a picker hands on
 * every keystroke, so typing "0255" over 02:40 passes 00:40, and the outcome may not depend on
 * what was passed.
 */
export function rangeFrom(
  parts: RangeParts,
  current: RangeInstants,
  timeZone: TimeZone,
  isEdit: boolean,
  original: RangeInstants = current,
): {
  readonly start: InstantOutcome;
  readonly end: InstantOutcome;
  /** The end stays on the start day despite its wall-clock time suggesting "+1". */
  readonly sameDayEnd?: CalendarDay;
} {
  const previous = (instant: Instant | null) =>
    isEdit && instant !== null ? { previous: instant } : {};
  const start = outcomeOf(parts.day, parts.startTime, current.start, original.start, timeZone, {
    ...previous(original.start),
  });
  const lowerBound = instantOf(start, current.start);
  const endOptions = {
    ...(lowerBound === null ? {} : { lowerBound }),
    ...previous(original.end),
  };
  const { day, endTime } = parts;
  // An end that reads as not after the start can still follow it on this day: the second showing
  // of an earlier time, after a start in the first. It is resolved as for an explicit end date
  // (D361, D366). On an edit only while the stored end lies on this day: an end stored on the
  // next day stays there, however the field is touched.
  const mayStayOnDay =
    !isEdit || (original.end !== null && calendarDayOf(original.end, timeZone) === day);
  if (
    isNextDay(parts) &&
    day !== null &&
    lowerBound !== null &&
    mayStayOnDay &&
    repeatedTimeOffset(lowerBound, timeZone) !== null
  ) {
    const end = outcomeOf(day, endTime, current.end, original.end, timeZone, endOptions);
    const instant = instantOf(end, current.end);
    if (
      instant !== null &&
      epochMsOf(instant) > epochMsOf(lowerBound) &&
      repeatedTimeOffset(instant, timeZone) !== null
    ) {
      return { start, end, sameDayEnd: day };
    }
  }
  const end = outcomeOf(dayOfEnd(parts), endTime, current.end, original.end, timeZone, endOptions);
  return { start, end };
}
