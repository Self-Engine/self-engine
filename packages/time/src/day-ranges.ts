// The cut of a range of Instants at the day boundaries of a zone (D343). The boundaries of a Day
// Span are computed once, with Temporal; the cut itself only compares Instants, so a caller that
// cuts many ranges pays one comparison per range and day boundary.
import { addDays } from "./calendar.ts";
import type { CalendarDay, DaySpan } from "./values.ts";
import type { TimeZone } from "./zone.ts";
import type { InstantRange } from "./zoned.ts";
import { startOfCalendarDay } from "./zoned-day.ts";

/**
 * A Calendar Day with the Instants it covers in a zone, half-open: from its first moment up to
 * the next day's first. A day the clocks change on is 23 or 25 hours long, or as long as the zone
 * makes it.
 */
export interface DayRange extends InstantRange {
  readonly day: CalendarDay;
}

/** The days of a span in a zone, in order, each with its Instants. */
export function dayRangesOf(span: DaySpan, timeZone: TimeZone): readonly DayRange[] {
  const days: DayRange[] = [];
  let day = span.first;
  let start = startOfCalendarDay(day, timeZone);
  while (day <= span.last) {
    const next = addDays(day, 1);
    const end = startOfCalendarDay(next, timeZone);
    days.push({ day, start, end });
    day = next;
    start = end;
  }
  return days;
}

/**
 * The pieces of `range` that lie in each of `days`, in order: each piece carries its day and the
 * part of the range inside it. A day the range does not touch gives no piece, and a part outside
 * every day is left out. `days` are consecutive and in order, as `dayRangesOf` gives them; when
 * they cover the range, the pieces follow each other without a gap from its start to its end.
 */
export function cutAtDays(range: InstantRange, days: readonly DayRange[]): readonly DayRange[] {
  const pieces: DayRange[] = [];
  // Instants of the supported years compare as text in time order.
  for (const { day, start, end } of days) {
    if (end <= range.start) continue;
    if (start >= range.end) break;
    pieces.push({
      day,
      start: start > range.start ? start : range.start,
      end: end < range.end ? end : range.end,
    });
  }
  return pieces;
}
