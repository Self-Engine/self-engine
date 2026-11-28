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
  type Break,
  computeTimeEntry,
  ORDINARY_ROUNDING_MINUTES,
  NOT_WORK_KINDS,
  ROUNDING_DIRECTIONS,
} from "./contracts/index.ts";

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

const exactRule = fc.constant({ kind: "exact" as const });
const anyRule = fc.oneof(exactRule, ordinaryRule, blockRule);

/**
 * Breaks around an entry of `length` seconds from `start`, as any data may hold them: inside it,
 * across or beyond its edges, overlapping, and shorter than a second or ending before they start.
 */
const breaksAround = (start: number, length: number) =>
  fc.array(
    fc
      .tuple(
        fc.integer({ min: -600, max: length + 600 }),
        fc.integer({ min: -60, max: Math.max(60, Math.floor(length / 2)) }),
        fc.boolean(),
      )
      .map(([offset, breakLength, rest]): Break =>
        rest
          ? {
              timeKind: "rest_break",
              startedAt: instantOfSeconds(start + offset),
              endedAt: instantOfSeconds(start + offset + breakLength),
              changedByLimit: false,
            }
          : {
              timeKind: "short_break",
              startedAt: instantOfSeconds(start + offset),
              endedAt: instantOfSeconds(start + offset + breakLength),
            },
      ),
    { maxLength: 6 },
  );

/** An entry with any list of breaks. */
const entryWithBreaks = fc.tuple(startSeconds, lengthSeconds).chain(([start, length]) =>
  fc.record({
    measured: fc.constant({
      start: instantOfSeconds(start),
      end: instantOfSeconds(start + length),
    }),
    breaks: breaksAround(start, length),
  }),
);

/**
 * An entry with breaks that keep the rules: each between Work, none overlapping another. Their
 * borders are distinct seconds strictly inside the entry, taken in pairs.
 */
const entryWithValidBreaks = fc
  .tuple(
    startSeconds,
    lengthSeconds.filter((length) => length >= 3),
  )
  .chain(([start, length]) =>
    fc.record({
      measured: fc.constant({
        start: instantOfSeconds(start),
        end: instantOfSeconds(start + length),
      }),
      breaks: fc
        .tuple(
          fc.uniqueArray(fc.integer({ min: 1, max: length - 1 }), { maxLength: 8 }),
          fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        )
        .map(([borders, rests]) => {
          const sorted = borders.toSorted((a, b) => a - b);
          const breaks: Break[] = [];
          for (let index = 0; index + 1 < sorted.length; index += 2) {
            const startedAt = instantOfSeconds(start + sorted[index]!);
            const endedAt = instantOfSeconds(start + sorted[index + 1]!);
            breaks.push(
              rests[index / 2]
                ? { timeKind: "rest_break", startedAt, endedAt, changedByLimit: false }
                : { timeKind: "short_break", startedAt, endedAt },
            );
          }
          return breaks;
        }),
    }),
  );

/** The same break as a Short Break: it then counts. */
const asShortBreak = (stretch: Break): Break => ({
  timeKind: "short_break",
  startedAt: stretch.startedAt,
  endedAt: stretch.endedAt,
});

const onWholeMinute = (instant: Instant) => epochMsOf(instant) % 60_000 === 0;

test("Exact changes nothing", () => {
  fc.assert(
    fc.property(measuredTime, timeZone, (measured, zone) => {
      expect(
        computeTimeEntry({
          timeKind: "work",
          measuredTime: measured,
          timeZone: zone,
          rule: { kind: "exact" },
          breaks: [],
        }),
      ).toEqual({
        roundedTime: measured,
        bookedDuration: durationBetween(measured.start, measured.end),
        findings: [],
        projectShares: [],
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
        timeKind: "work",
        measuredTime: measured,
        timeZone: zone,
        rule: chosen,
        breaks: [],
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
      const { bookedDuration } = computeTimeEntry({
        timeKind: "work",
        measuredTime: measured,
        timeZone: zone,
        rule,
        breaks: [],
      });
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
        timeKind: "work",
        measuredTime: measured,
        timeZone: zone,
        rule,
        breaks: [],
      });
      expect(bookedDuration % (rule.minutes * 60)).toBe(0);
      expect(roundedTime).not.toBeNull();
      expect(roundedTime!.start <= measured.start).toBe(true);
      expect(roundedTime!.end >= measured.end).toBe(true);
    }),
    parameters,
  );
});

test("a Rest Break never takes more work time than its own length", () => {
  fc.assert(
    fc.property(entryWithValidBreaks, timeZone, anyRule, ({ measured, breaks }, zone, rule) => {
      const rests = breaks.filter((stretch) => stretch.timeKind === "rest_break");
      fc.pre(rests.length > 0);
      const compute = (list: readonly Break[], chosen = rule) =>
        computeTimeEntry({ timeKind: "work", measuredTime: measured, timeZone: zone, rule: chosen, breaks: list });
      expect(compute(breaks).findings).toEqual([]);
      // Each Rest Break in turn as a Short Break, the others as they are.
      for (const rest of rests) {
        const counting = breaks.map((stretch) =>
          stretch === rest ? asShortBreak(stretch) : stretch,
        );
        const length = Math.max(0, (epochMsOf(rest.endedAt) - epochMsOf(rest.startedAt)) / 1000);
        const taken = compute(counting).bookedDuration - compute(breaks).bookedDuration;
        if (rule.kind === "ordinary") {
          // The rule rounds the work time; no break is rounded on its own first.
          const work = compute(breaks, { kind: "exact" }).bookedDuration;
          const alone = computeTimeEntry({
            timeKind: "work",
            measuredTime: {
              start: measured.start,
              end: instantOfSeconds(epochMsOf(measured.start) / 1000 + work),
            },
            timeZone: zone,
            rule,
            breaks: [],
          });
          expect(compute(breaks).bookedDuration).toBe(work === 0 ? 0 : alone.bookedDuration);
        } else {
          expect(taken).toBeGreaterThanOrEqual(0);
          expect(taken).toBeLessThanOrEqual(length);
        }
      }
    }),
    parameters,
  );
});

test("every list of breaks has a result", () => {
  fc.assert(
    fc.property(entryWithBreaks, timeZone, anyRule, ({ measured, breaks }, zone, rule) => {
      const { roundedTime, bookedDuration } = computeTimeEntry({
        timeKind: "work",
        measuredTime: measured,
        timeZone: zone,
        rule,
        breaks,
      });
      expect(bookedDuration).toBeGreaterThanOrEqual(0);
      expect(roundedTime === null).toBe(bookedDuration === 0);
      if (roundedTime !== null) expect(roundedTime.end > roundedTime.start).toBe(true);
      if (rule.kind === "exact")
        expect(bookedDuration).toBeLessThanOrEqual(durationBetween(measured.start, measured.end));
    }),
    parameters,
  );
});

test("an entry that is not work is the same entry without breaks, rounded whole: a Short Break books its Rounded Time, a Rest Break and Leisure nothing", () => {
  fc.assert(
    fc.property(
      entryWithBreaks,
      timeZone,
      anyRule,
      fc.constantFrom(...NOT_WORK_KINDS),
      ({ measured, breaks }, zone, chosen, timeKind) => {
        const { roundedTime, bookedDuration, projectShares } = computeTimeEntry({
          timeKind,
          measuredTime: measured,
          timeZone: zone,
          rule: chosen,
          breaks,
          projects: [{ weight: 1 }],
        });
        const asWork = computeTimeEntry({
          timeKind: "work",
          measuredTime: measured,
          timeZone: zone,
          rule: chosen,
          breaks: [],
        });
        expect(roundedTime).toEqual(asWork.roundedTime);
        const length =
          roundedTime === null ? 0 : durationBetween(roundedTime.start, roundedTime.end);
        expect(bookedDuration).toBe(timeKind === "short_break" ? length : 0);
        expect(projectShares).toEqual([]);
      },
    ),
    parameters,
  );
});
