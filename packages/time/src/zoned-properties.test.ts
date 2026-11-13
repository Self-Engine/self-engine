import fc from "fast-check";
import { expect, test } from "vite-plus/test";
import { listedTimeZones } from "./check/intl-comparison.ts";
import {
  addDays,
  calendarDayOf,
  epochMsOf,
  instantAt,
  instantRangeOf,
  instantSchema,
  resolveTimeZone,
  wallClockTimeOf,
  type TimeZone,
} from "./index.ts";

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
