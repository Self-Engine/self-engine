import fc from "fast-check";
import {
  calendarDayOf,
  dayRangesOf,
  daySpanSchema,
  durationBetween,
  instantSchema,
  resolveTimeZone,
} from "@self-engine/time";
import { advanceInstantByMilliseconds } from "@self-engine/time/testing";
import { expect, test } from "vite-plus/test";
import { dayShares } from "./day-shares.ts";

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const instant = (text: string) => instantSchema.parse(text);
const span = (first: string, last: string) => daySpanSchema.parse({ first, last });
const hours = (count: number) => count * 3600;
const entry = (startedAt: string, endedAt: string) => ({
  startedAt: instant(startedAt),
  endedAt: instant(endedAt),
});

test("an entry inside one day has its whole duration as that day's share and no mark", () => {
  const days = dayRangesOf(span("2026-11-16", "2026-11-22"), BERLIN);
  expect(dayShares(entry("2026-11-16T09:00:00.000Z", "2026-11-16T10:30:00.000Z"), days)).toEqual({
    shares: [{ day: "2026-11-16", seconds: 5400 }],
    crossesMidnight: false,
  });
});

test("an entry across midnight has a share on each day and is marked", () => {
  // Sunday 22:00 to Monday 02:00 in Berlin.
  const across = entry("2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z");
  expect(dayShares(across, dayRangesOf(span("2026-11-09", "2026-11-22"), BERLIN))).toEqual({
    shares: [
      { day: "2026-11-15", seconds: hours(2) },
      { day: "2026-11-16", seconds: hours(2) },
    ],
    crossesMidnight: true,
  });
});

test("a span counts only the shares inside it, and the entry stays marked in each", () => {
  const across = entry("2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z");
  expect(dayShares(across, dayRangesOf(span("2026-11-09", "2026-11-15"), BERLIN))).toEqual({
    shares: [{ day: "2026-11-15", seconds: hours(2) }],
    crossesMidnight: true,
  });
  expect(dayShares(across, dayRangesOf(span("2026-11-16", "2026-11-22"), BERLIN))).toEqual({
    shares: [{ day: "2026-11-16", seconds: hours(2) }],
    crossesMidnight: true,
  });
});

test("an entry that ends at midnight touches one day and is not marked", () => {
  const days = dayRangesOf(span("2026-11-16", "2026-11-17"), BERLIN);
  expect(dayShares(entry("2026-11-16T21:00:00.000Z", "2026-11-16T23:00:00.000Z"), days)).toEqual({
    shares: [{ day: "2026-11-16", seconds: hours(2) }],
    crossesMidnight: false,
  });
});

// Entries of up to three days, starting on a whole second within four days around each clock
// change of Berlin in 2026.
const aroundChanges = fc.constantFrom(
  instant("2026-03-26T00:00:00.000Z"),
  instant("2026-10-22T00:00:00.000Z"),
);
const offset = fc.integer({ min: 0, max: 4 * 86_400 });
const length = fc.integer({ min: 1, max: 3 * 86_400 });

test("the Day Shares of an entry add up to exactly its duration, also across a clock change", () => {
  fc.assert(
    fc.property(aroundChanges, offset, length, (base, after, seconds) => {
      const startedAt = advanceInstantByMilliseconds(base, after * 1000);
      const endedAt = advanceInstantByMilliseconds(startedAt, seconds * 1000);
      const days = dayRangesOf(
        daySpanSchema.parse({
          first: calendarDayOf(startedAt, BERLIN),
          last: calendarDayOf(endedAt, BERLIN),
        }),
        BERLIN,
      );
      const { shares } = dayShares({ startedAt, endedAt }, days);
      expect(shares.reduce((sum, share) => sum + share.seconds, 0)).toBe(
        durationBetween(startedAt, endedAt),
      );
      expect(shares.every((share) => share.seconds > 0)).toBe(true);
    }),
    { seed: 341, numRuns: 300 },
  );
});
