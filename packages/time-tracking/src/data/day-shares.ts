import {
  type CalendarDay,
  cutAtDays,
  type DayRange,
  type Duration,
  durationBetween,
  type Instant,
} from "@self-engine/time";

/** The seconds of an entry that lie in one Calendar Day: its Day Share there (D343). */
export interface DayShare {
  readonly day: CalendarDay;
  readonly seconds: Duration;
}

/**
 * The one place that splits a time entry over days (D343): its Day Share on each of `days` it
 * touches, in order, and whether it touches more than one day, inside the days or beyond them.
 * In layer 4 the Booked Duration is end minus start, so a share is the length of the entry's
 * piece in that day, and the shares over all days it touches add up to exactly its duration. A
 * later setting ("count for the day it begins") and the rounding rule change this function
 * (D343, D345). `days` are consecutive whole days, as `dayRangesOf` gives them.
 */
export function dayShares(
  entry: { readonly startedAt: Instant; readonly endedAt: Instant },
  days: readonly DayRange[],
): { readonly shares: readonly DayShare[]; readonly crossesMidnight: boolean } {
  const range = { start: entry.startedAt, end: entry.endedAt };
  const pieces = cutAtDays(range, days);
  const first = days[0];
  const last = days.at(-1);
  // Beyond the days lie only other days: a part outside them is a part on another day.
  const beyond =
    first !== undefined &&
    last !== undefined &&
    (range.start < first.start || range.end > last.end);
  return {
    shares: pieces.map((piece) => ({
      day: piece.day,
      seconds: durationBetween(piece.start, piece.end),
    })),
    crossesMidnight: pieces.length > 1 || beyond,
  };
}
