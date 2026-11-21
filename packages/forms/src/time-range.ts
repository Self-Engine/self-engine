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
  moveToDay,
  repeatedTimeOffset,
  resolveWallClockTime,
  type TimeZone,
  type WallClockTime,
  wallClockTimeOf,
} from "@self-engine/time";

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

/** What becomes of one Instant of the draft after the field changed. */
export type RangeOutcome =
  /** It still shows the field's date and time: it stays, with its seconds (D344). */
  | { readonly case: "keep" }
  /** It takes this Instant, or "empty" while a part it needs is empty. */
  | { readonly case: "set"; readonly instant: Instant | null }
  /** The clocks skip the time on that day: no value, the save is blocked (D347). */
  | { readonly case: "skipped" };

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

function shows(
  instant: Instant | null,
  day: CalendarDay,
  time: WallClockTime,
  timeZone: TimeZone,
): boolean {
  return (
    instant !== null &&
    calendarDayOf(instant, timeZone) === day &&
    wallClockTimeOf(instant, timeZone) === time
  );
}

function outcomeOf(
  day: CalendarDay | null,
  time: WallClockTime | null,
  current: Instant | null,
  original: Instant | null,
  timeZone: TimeZone,
  options: { readonly previous?: Instant; readonly lowerBound?: Instant },
): RangeOutcome {
  if (day === null || time === null) return { case: "set", instant: null };
  if (shows(current, day, time, timeZone)) return { case: "keep" };
  if (original !== null && shows(original, day, time, timeZone))
    return { case: "set", instant: original };
  // A time the user did not touch whose day changed moves to that day with its seconds (D344).
  const untouched = [current, original].find(
    (instant): instant is Instant =>
      instant !== null && wallClockTimeOf(instant, timeZone) === time,
  );
  const resolved =
    untouched === undefined
      ? resolveWallClockTime(day, time, timeZone, options)
      : moveToDay(untouched, day, timeZone, options);
  return resolved.case === "skipped" ? resolved : { case: "set", instant: resolved.instant };
}

function instantOf(outcome: RangeOutcome, current: Instant | null): Instant | null {
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
  readonly start: RangeOutcome;
  readonly end: RangeOutcome;
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
  // A correction can keep the stored end on this day if the repeated time still follows
  // the start. Use the same resolution as for an explicit end date (D361, D366).
  if (
    isNextDay(parts) &&
    day !== null &&
    lowerBound !== null &&
    isEdit &&
    original.end !== null &&
    calendarDayOf(original.end, timeZone) === day
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
