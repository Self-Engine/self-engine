import {
  addDuration,
  durationBetween,
  durationSchema,
  epochMsOf,
  type Instant,
  resolveTimeZone,
} from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import fc from "fast-check";
import { expect, test } from "vite-plus/test";
import {
  BLOCK_ROUNDING_MINUTES,
  computeTimeEntry,
  ORDINARY_ROUNDING_MINUTES,
  ROUNDING_DIRECTIONS,
} from "./index.ts";

const parameters = { seed: 381128, numRuns: 5000 };

// Whole seconds from 1990 to 2100, after Kathmandu moved its clock by a quarter hour (1986).
const startSeconds = fc.integer({ min: 631152000, max: 4102444800 });
// From one second up to two days, so entries cross midnight and clock changes.
const lengthSeconds = fc.oneof(
  fc.integer({ min: 1, max: 3600 }),
  fc.integer({ min: 1, max: 2 * 86400 }),
);
const epoch = requireInstant("1970-01-01T00:00:00.000Z");
const instantOfSeconds = (seconds: number) => addDuration(epoch, durationSchema.parse(seconds));

const measuredTime = fc.tuple(startSeconds, lengthSeconds).map(([start, length]) => ({
  start: instantOfSeconds(start),
  end: instantOfSeconds(start + length),
}));

// Offsets of whole hours, of half and three quarter hours, with and without clock changes. Each
// changes its clock on a full hour or half hour, so a Block of the clock is never cut by a change.
const timeZone = fc
  .constantFrom(
    "UTC",
    "Europe/Berlin",
    "America/New_York",
    "Asia/Kolkata",
    "Asia/Kathmandu",
    "America/St_Johns",
    "Australia/Adelaide",
  )
  .map((name) => resolveTimeZone(name).timeZone);

const ordinaryRule = fc.record({
  kind: fc.constant("ordinary" as const),
  direction: fc.constantFrom(...ROUNDING_DIRECTIONS),
  minutes: fc.constantFrom(...ORDINARY_ROUNDING_MINUTES),
});
const blockRule = fc.record({
  kind: fc.constant("block" as const),
  minutes: fc.constantFrom(...BLOCK_ROUNDING_MINUTES),
});

const onWholeMinute = (instant: Instant) => epochMsOf(instant) % 60_000 === 0;

test("Exact changes nothing", () => {
  fc.assert(
    fc.property(measuredTime, timeZone, (measured, zone) => {
      expect(
        computeTimeEntry({ measuredTime: measured, timeZone: zone, rule: { kind: "exact" } }),
      ).toEqual({
        roundedTime: measured,
        bookedDuration: durationBetween(measured.start, measured.end),
      });
    }),
    parameters,
  );
});

test("under every other rule a Rounded Time lies on whole minutes and holds the Booked Duration", () => {
  const rule = fc.oneof(ordinaryRule, blockRule);
  fc.assert(
    fc.property(measuredTime, timeZone, rule, (measured, zone, chosen) => {
      const { roundedTime, bookedDuration } = computeTimeEntry({
        measuredTime: measured,
        timeZone: zone,
        rule: chosen,
      });
      expect(bookedDuration % 60).toBe(0);
      if (roundedTime === null) {
        expect(bookedDuration).toBe(0);
        return;
      }
      expect(onWholeMinute(roundedTime.start)).toBe(true);
      expect(onWholeMinute(roundedTime.end)).toBe(true);
      expect(durationBetween(roundedTime.start, roundedTime.end)).toBe(bookedDuration);
    }),
    parameters,
  );
});

test("rounding up never counts less than was measured, rounding down never more", () => {
  fc.assert(
    fc.property(measuredTime, timeZone, ordinaryRule, (measured, zone, rule) => {
      const { bookedDuration } = computeTimeEntry({ measuredTime: measured, timeZone: zone, rule });
      const length = durationBetween(measured.start, measured.end);
      if (rule.direction === "up") expect(bookedDuration).toBeGreaterThanOrEqual(length);
      if (rule.direction === "down") expect(bookedDuration).toBeLessThanOrEqual(length);
    }),
    parameters,
  );
});

test("under Block Rounding the Booked Duration is a whole number of Blocks around the measurement", () => {
  fc.assert(
    fc.property(measuredTime, timeZone, blockRule, (measured, zone, rule) => {
      const { roundedTime, bookedDuration } = computeTimeEntry({
        measuredTime: measured,
        timeZone: zone,
        rule,
      });
      expect(bookedDuration % (rule.minutes * 60)).toBe(0);
      expect(roundedTime).not.toBeNull();
      expect(roundedTime!.start <= measured.start).toBe(true);
      expect(roundedTime!.end >= measured.end).toBe(true);
    }),
    parameters,
  );
});
