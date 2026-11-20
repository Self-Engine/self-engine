// What the field "date, start, end" writes into its two Instants (D319, D344, D347). The field
// shows a date, a start time, an end time and, when opened, an end date; this turns what it shows
// into the two Instants of the draft. Every computation of time is a function of `time`: the day
// and wall-clock time an Instant shows, the next day, and the resolution of a clock change, whose
// rule stays there in one place.

import {
  addDays,
  type CalendarDay,
  calendarDayOf,
  type Instant,
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
  /** The opened end date; `null` while the end follows `day`, or the next day ("+1"). */
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
 * Whether the end lies on the day after the date: no end date is opened and the end time is not
 * after the start time. The field shows "+1" then.
 */
export function isNextDay(parts: RangeParts): boolean {
  const { endDay, startTime, endTime } = parts;
  // `HH:MM` has a fixed width, so its text sorts as the time does.
  return endDay === null && startTime !== null && endTime !== null && endTime <= startTime;
}

/** The day the end lies on, as the field shows it. */
function dayOfEnd(parts: RangeParts): CalendarDay | null {
  if (parts.endDay !== null) return parts.endDay;
  if (parts.day === null) return null;
  return isNextDay(parts) ? addDays(parts.day, 1) : parts.day;
}

/**
 * What the field shows for two Instants of the draft. The end date opens when the end lies on
 * another day than the date and "+1" would say: over several days, or on the date itself while
 * its time reads as not after the start.
 */
export function partsOf(start: Instant | null, end: Instant | null, timeZone: TimeZone): RangeParts {
  const closed: RangeParts = {
    day: start === null ? null : calendarDayOf(start, timeZone),
    startTime: start === null ? null : wallClockTimeOf(start, timeZone),
    endTime: end === null ? null : wallClockTimeOf(end, timeZone),
    endDay: null,
  };
  if (end === null) return closed;
  const endDay = calendarDayOf(end, timeZone);
  return dayOfEnd(closed) === endDay ? closed : { ...closed, endDay };
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
  timeZone: TimeZone,
  options: { readonly previous?: Instant; readonly lowerBound?: Instant },
): RangeOutcome {
  if (day === null || time === null) return { case: "set", instant: null };
  if (shows(current, day, time, timeZone)) return { case: "keep" };
  const resolved = resolveWallClockTime(day, time, timeZone, options);
  return resolved.case === "skipped" ? resolved : { case: "set", instant: resolved.instant };
}

/**
 * The two Instants for what the field shows. An Instant that still shows its date and time stays
 * with its seconds; any other is resolved by `time` (D347): on an edit (`isEdit`) with the Instant
 * the draft held as the previous value, else the end with the start as its lower bound.
 */
export function rangeFrom(
  parts: RangeParts,
  current: RangeInstants,
  timeZone: TimeZone,
  isEdit: boolean,
): { readonly start: RangeOutcome; readonly end: RangeOutcome } {
  const previous = (instant: Instant | null) =>
    isEdit && instant !== null ? { previous: instant } : {};
  const start = outcomeOf(parts.day, parts.startTime, current.start, timeZone, {
    ...previous(current.start),
  });
  const lowerBound =
    start.case === "set" ? start.instant : start.case === "keep" ? current.start : null;
  const end = outcomeOf(dayOfEnd(parts), parts.endTime, current.end, timeZone, {
    ...(lowerBound === null ? {} : { lowerBound }),
    ...previous(current.end),
  });
  return { start, end };
}
