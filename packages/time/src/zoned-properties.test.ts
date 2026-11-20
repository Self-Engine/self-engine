import fc from "fast-check";
import { expect, test } from "vite-plus/test";
import { clockChangesOf, instantAtMs, listedTimeZones } from "./check/clock-changes.ts";
import {
  addDays,
  calendarDayOf,
  calendarDaySchema,
  epochMsOf,
  instantAt,
  instantRangeOf,
  instantSchema,
  repeatedTimeOffset,
  resolveTimeZone,
  resolveWallClockTime,
  wallClockTimeOf,
  wallClockTimeSchema,
  type TimeZone,
} from "./index.ts";
import { utcOffsetText } from "./utc-offset.ts";

// Years 1001–9998, so that a day and the day after it stay inside the supported years everywhere.
const epochMs = fc.integer({ min: -30578688000000, max: 253370764799999 });
const instantFromMs = (milliseconds: number) =>
  instantSchema.parse(
    Temporal.Instant.fromEpochMilliseconds(milliseconds).toString({ fractionalSecondDigits: 3 }),
  );
const parameters = { seed: 242104, numRuns: 25 };

function inEveryListedZone(property: (timeZone: TimeZone, milliseconds: number) => void): void {
  for (const name of listedTimeZones()) {
    const { timeZone } = resolveTimeZone(name);
    fc.assert(
      fc.property(epochMs, (milliseconds) => property(timeZone, milliseconds)),
      parameters,
    );
  }
}

test("an Instant's day and wall-clock time lead back to the Instant, to the minute", () => {
  inEveryListedZone((timeZone, milliseconds) => {
    const instant = instantFromMs(milliseconds);
    const resolved = instantAt(
      calendarDayOf(instant, timeZone),
      wallClockTimeOf(instant, timeZone),
      timeZone,
    );
    const candidates =
      resolved.case === "repeated" ? [resolved.instant, resolved.later] : [resolved.instant];
    expect(resolved.case, timeZone).not.toBe("skipped");
    const minuteStarts = candidates.map(epochMsOf);
    expect(
      minuteStarts.some((start) => start <= milliseconds && milliseconds < start + 60_000),
      `${instant} in ${timeZone}`,
    ).toBe(true);
  });
});

test("the end of a day's range is the start of the next day's", () => {
  inEveryListedZone((timeZone, milliseconds) => {
    const day = calendarDayOf(instantFromMs(milliseconds), timeZone);
    const range = instantRangeOf(day, timeZone);
    expect(range.start <= range.end, `${day} in ${timeZone}`).toBe(true);
    expect(range.end, `${day} in ${timeZone}`).toBe(
      instantRangeOf(addDays(day, 1), timeZone).start,
    );
  });
});

test("a wall-clock minute inside each clock change is skipped or resolves to either occurrence", () => {
  const minuteMs = 60_000;
  for (const name of listedTimeZones()) {
    const { timeZone } = resolveTimeZone(name);
    for (const change of clockChangesOf(timeZone, 1970, 2040)) {
      const before = Temporal.Instant.fromEpochMilliseconds(change - 1).toZonedDateTimeISO(
        timeZone,
      );
      const after = Temporal.Instant.fromEpochMilliseconds(change).toZonedDateTimeISO(timeZone);
      const beforeMs = before.offsetNanoseconds / 1_000_000;
      const afterMs = after.offsetNanoseconds / 1_000_000;
      // Use UTC as a coordinate system for the wall-clock interval between the two offsets.
      const minute = Math.ceil((change + Math.min(beforeMs, afterMs)) / minuteMs) * minuteMs;
      if (minute >= change + Math.max(beforeMs, afterMs)) continue;
      const wall = Temporal.Instant.fromEpochMilliseconds(minute).toString({
        smallestUnit: "minute",
      });
      const day = calendarDaySchema.parse(wall.slice(0, 10));
      const time = wallClockTimeSchema.parse(wall.slice(11, 16));
      const actual = resolveWallClockTime(day, time, timeZone);
      const context = `${day} ${time} in ${timeZone}`;
      if (afterMs > beforeMs) {
        expect(actual, context).toEqual({ case: "skipped" });
      } else {
        const later = instantAtMs(minute - afterMs);
        expect(actual, context).toEqual({
          case: "repeated",
          instant: instantAtMs(minute - beforeMs),
          occurrence: "earlier",
        });
        // Both occurrences name their own offset beside the time; the minute after the change
        // shows once.
        expect(repeatedTimeOffset(instantAtMs(minute - beforeMs), timeZone), context).toBe(
          utcOffsetText(beforeMs / minuteMs),
        );
        expect(repeatedTimeOffset(later, timeZone), context).toBe(
          utcOffsetText(afterMs / minuteMs),
        );
        expect(resolveWallClockTime(day, time, timeZone, { previous: later }), context).toEqual({
          case: "repeated",
          instant: later,
          occurrence: "later",
        });
      }
    }
  }
}, 30_000);
