import fc from "fast-check";
import { expect, test } from "vite-plus/test";
import { listedTimeZones } from "./check/clock-changes.ts";
import {
  calendarDayOf,
  cutAtDays,
  dayRangesOf,
  daySpanSchema,
  durationBetween,
  epochMsOf,
  instantSchema,
  resolveTimeZone,
  type CalendarDay,
  type TimeZone,
} from "./index.ts";

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const TOKYO = resolveTimeZone("Asia/Tokyo").timeZone;
const NEW_YORK = resolveTimeZone("America/New_York").timeZone;
const instant = (text: string) => instantSchema.parse(text);
const span = (first: string, last: string) => daySpanSchema.parse({ first, last });
const hours = (count: number) => count * 3600;

/** Each piece as its day and its seconds, the way a reader checks it. */
function secondsPerDay(start: string, end: string, days: ReturnType<typeof dayRangesOf>) {
  return cutAtDays({ start: instant(start), end: instant(end) }, days).map((piece) => [
    piece.day,
    durationBetween(piece.start, piece.end),
  ]);
}

test("the days of a span run from each day's first moment to the next day's, in order", () => {
  expect(dayRangesOf(span("2026-11-16", "2026-11-18"), BERLIN)).toEqual([
    { day: "2026-11-16", start: "2026-11-15T23:00:00.000Z", end: "2026-11-16T23:00:00.000Z" },
    { day: "2026-11-17", start: "2026-11-16T23:00:00.000Z", end: "2026-11-17T23:00:00.000Z" },
    { day: "2026-11-18", start: "2026-11-17T23:00:00.000Z", end: "2026-11-18T23:00:00.000Z" },
  ]);
});

test("the day the clocks go forward has 23 hours, the day they go back 25", () => {
  const [spring] = dayRangesOf(span("2026-03-29", "2026-03-29"), BERLIN);
  const [autumn] = dayRangesOf(span("2026-10-25", "2026-10-25"), BERLIN);
  expect(spring && durationBetween(spring.start, spring.end)).toBe(hours(23));
  expect(autumn && durationBetween(autumn.start, autumn.end)).toBe(hours(25));
});

test("a range across midnight is cut at the day boundary of the zone", () => {
  // Sunday 22:00 to Monday 02:00 in Berlin.
  const days = dayRangesOf(span("2026-11-15", "2026-11-16"), BERLIN);
  expect(secondsPerDay("2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z", days)).toEqual([
    ["2026-11-15", hours(2)],
    ["2026-11-16", hours(2)],
  ]);
});

test("the same range falls on other days in a zone east and one west of UTC", () => {
  const start = "2026-11-15T21:00:00.000Z";
  const end = "2026-11-16T01:00:00.000Z";
  // Tokyo: Monday 06:00 to 10:00; New York: Sunday 16:00 to 20:00.
  expect(secondsPerDay(start, end, dayRangesOf(span("2026-11-15", "2026-11-16"), TOKYO))).toEqual([
    ["2026-11-16", hours(4)],
  ]);
  expect(
    secondsPerDay(start, end, dayRangesOf(span("2026-11-15", "2026-11-16"), NEW_YORK)),
  ).toEqual([["2026-11-15", hours(4)]]);
});

test("a range over the night of a clock change counts the time that passed", () => {
  // Saturday 22:00 to Sunday 06:00 on the wall clock in Berlin, both nights of 2026.
  const forward = dayRangesOf(span("2026-03-28", "2026-03-29"), BERLIN);
  expect(secondsPerDay("2026-03-28T21:00:00.000Z", "2026-03-29T04:00:00.000Z", forward)).toEqual([
    ["2026-03-28", hours(2)],
    ["2026-03-29", hours(5)],
  ]);
  const back = dayRangesOf(span("2026-10-24", "2026-10-25"), BERLIN);
  expect(secondsPerDay("2026-10-24T20:00:00.000Z", "2026-10-25T05:00:00.000Z", back)).toEqual([
    ["2026-10-24", hours(2)],
    ["2026-10-25", hours(7)],
  ]);
});

test("a range over three days gives a whole middle day, and only the parts inside the days count", () => {
  // Monday 20:00 to Wednesday 04:00 in Berlin.
  const start = "2026-11-16T19:00:00.000Z";
  const end = "2026-11-18T03:00:00.000Z";
  expect(secondsPerDay(start, end, dayRangesOf(span("2026-11-16", "2026-11-18"), BERLIN))).toEqual([
    ["2026-11-16", hours(4)],
    ["2026-11-17", hours(24)],
    ["2026-11-18", hours(4)],
  ]);
  expect(secondsPerDay(start, end, dayRangesOf(span("2026-11-17", "2026-11-17"), BERLIN))).toEqual([
    ["2026-11-17", hours(24)],
  ]);
  expect(secondsPerDay(start, end, dayRangesOf(span("2026-11-19", "2026-11-20"), BERLIN))).toEqual(
    [],
  );
});

test("a range that ends at midnight touches only the day before", () => {
  const days = dayRangesOf(span("2026-11-16", "2026-11-17"), BERLIN);
  expect(secondsPerDay("2026-11-16T21:00:00.000Z", "2026-11-16T23:00:00.000Z", days)).toEqual([
    ["2026-11-16", hours(2)],
  ]);
});

test("a day the zone skips gives no piece to a range that passes it", () => {
  // Samoa crossed the date line: 29 December 2011 was followed by 31 December.
  const apia = resolveTimeZone("Pacific/Apia").timeZone;
  const days = dayRangesOf(span("2011-12-29", "2011-12-31"), apia);
  expect(days[1]).toEqual({
    day: "2011-12-30",
    start: "2011-12-30T10:00:00.000Z",
    end: "2011-12-30T10:00:00.000Z",
  });
  expect(secondsPerDay("2011-12-30T09:00:00.000Z", "2011-12-30T11:00:00.000Z", days)).toEqual([
    ["2011-12-29", hours(1)],
    ["2011-12-31", hours(1)],
  ]);
});

// Ranges of up to four days, from 1972 on, when every zone in use had whole-minute offsets.
const startMs = fc.integer({ min: 63072000000, max: 2208988800000 });
const lengthMs = fc.integer({ min: 1, max: 4 * 86_400_000 });
const asInstant = (milliseconds: number) =>
  instant(
    Temporal.Instant.fromEpochMilliseconds(milliseconds).toString({ fractionalSecondDigits: 3 }),
  );

function spanOf(first: CalendarDay, last: CalendarDay) {
  return daySpanSchema.parse({ first, last });
}

test("the pieces of a range follow each other without a gap and add up to its duration, in every zone", () => {
  for (const name of listedTimeZones()) {
    const timeZone: TimeZone = resolveTimeZone(name).timeZone;
    fc.assert(
      fc.property(startMs, lengthMs, (from, length) => {
        const range = { start: asInstant(from), end: asInstant(from + length) };
        const days = dayRangesOf(
          spanOf(calendarDayOf(range.start, timeZone), calendarDayOf(range.end, timeZone)),
          timeZone,
        );
        const pieces = cutAtDays(range, days);
        expect(pieces[0]?.start).toBe(range.start);
        expect(pieces.at(-1)?.end).toBe(range.end);
        pieces.forEach((piece, index) => {
          expect(epochMsOf(piece.start)).toBeLessThan(epochMsOf(piece.end));
          if (index > 0) expect(piece.start).toBe(pieces[index - 1]?.end);
          expect(calendarDayOf(piece.start, timeZone)).toBe(piece.day);
        });
        const total = pieces.reduce(
          (sum, piece) => sum + durationBetween(piece.start, piece.end),
          0,
        );
        expect(total, `${range.start} to ${range.end} in ${name}`).toBe(
          durationBetween(range.start, range.end),
        );
      }),
      { seed: 341_275, numRuns: 5 },
    );
  }
});
