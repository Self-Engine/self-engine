// What a date and a wall-clock time write into one Instant of the draft (D319, D344, D347), the
// rule the field for one Instant and the field "date, start, end" share. Every computation of time
// is a function of `time`: the day and wall-clock time an Instant shows, and the resolution of a
// clock change, whose rule stays there in one place.

import {
  type CalendarDay,
  calendarDayOf,
  type Instant,
  moveToDay,
  resolveWallClockTime,
  type TimeZone,
  type WallClockTime,
  wallClockTimeOf,
} from "@self-engine/time";

/** What becomes of one Instant of the draft after its field changed. */
export type InstantOutcome =
  /** It still shows the field's date and time: it stays, with its seconds (D344). */
  | { readonly case: "keep" }
  /** It takes this Instant, or "empty" while a part it needs is empty. */
  | { readonly case: "set"; readonly instant: Instant | null }
  /** The clocks skip the time on that day: no value, the save is blocked (D347). */
  | { readonly case: "skipped" };

/** What the field for one Instant shows; each part may still be empty. */
export interface InstantParts {
  readonly day: CalendarDay | null;
  readonly time: WallClockTime | null;
}

/** What the field for one Instant shows for an Instant of the draft, in the Time Zone. */
export function instantPartsOf(instant: Instant | null, timeZone: TimeZone): InstantParts {
  return {
    day: instant === null ? null : calendarDayOf(instant, timeZone),
    time: instant === null ? null : wallClockTimeOf(instant, timeZone),
  };
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

/** How `time` resolves a wall-clock time: near a previous value, or not before a lower bound. */
export interface ResolveOptions {
  readonly previous?: Instant;
  readonly lowerBound?: Instant;
}

/**
 * The Instant for a date and a time. One that still shows them stays with its seconds, and so
 * does `original`, the Instant the field was drawn with: a value passing while a time is typed
 * may move it and back. One that still shows its time on another day moves to that day with its
 * seconds (`moveToDay`). Any other is resolved by `time` (D347, D361) with `options`.
 */
export function outcomeOf(
  day: CalendarDay | null,
  time: WallClockTime | null,
  current: Instant | null,
  original: Instant | null,
  timeZone: TimeZone,
  options: ResolveOptions,
): InstantOutcome {
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

/**
 * The Instant for what the field for one Instant shows: on an edit (`isEdit`) resolved with the
 * Instant of `original` as the previous value, never the one the draft holds now, since a picker
 * hands on every keystroke and the outcome may not depend on what was passed.
 */
export function instantFrom(
  parts: InstantParts,
  current: Instant | null,
  timeZone: TimeZone,
  isEdit: boolean,
  original: Instant | null = current,
): InstantOutcome {
  return outcomeOf(
    parts.day,
    parts.time,
    current,
    original,
    timeZone,
    isEdit && original !== null ? { previous: original } : {},
  );
}
