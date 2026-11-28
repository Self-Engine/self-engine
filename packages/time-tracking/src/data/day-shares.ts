import {
  type CalendarDay,
  cutAtDays,
  type DayRange,
  type Duration,
  durationBetween,
  type InstantRange,
} from "@self-engine/time";

/** The seconds of a Time Entry that lie in one Calendar Day: its Day Share there (D343). */
export interface DayShare {
  readonly day: CalendarDay;
  readonly seconds: Duration;
}

/**
 * The one place that splits a Time Entry over days (D343): its Day Share on each of `days` its
 * Rounded Time touches, in order, and whether it touches more than one day, inside the days or
 * beyond them. Without breaks the Booked Duration is the length of the Rounded Time, so each Day
 * Share is the length of its piece in that day, and the shares add up to the Booked Duration.
 * `days` are consecutive whole days, as `dayRangesOf` gives them.
 */
export function dayShares(
  range: InstantRange,
  days: readonly DayRange[],
): { readonly shares: readonly DayShare[]; readonly crossesMidnight: boolean } {
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
