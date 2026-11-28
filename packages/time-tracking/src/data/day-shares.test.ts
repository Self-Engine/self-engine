import fc from "fast-check";
import {
  addDuration,
  dayRangesOf,
  daySpanSchema,
  durationSchema,
  epochMsOf,
  instantSchema,
  resolveTimeZone,
} from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import { expect, test } from "vite-plus/test";
import {
  BLOCK_ROUNDING_MINUTES,
  type Break,
  computeTimeEntry,
  countedRanges,
  NOT_WORK_KINDS,
  ORDINARY_ROUNDING_MINUTES,
  ROUNDING_DIRECTIONS,
  type RoundingRule,
  type TimeKind,
} from "../contracts/index.ts";
import {
  crossesMidnight,
  divideOverDays,
  divideOverItsDays,
  divideProjectShares,
} from "./day-shares.ts";

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const instant = (text: string) => instantSchema.parse(text);
const span = (first: string, last: string) => daySpanSchema.parse({ first, last });
const minutes = (count: number) => count * 60;
const entry = (start: string, end: string) => ({ start: instant(start), end: instant(end) });

test("an entry inside one day does not cross midnight; one across it does, also beyond the days", () => {
  const week = dayRangesOf(span("2026-11-16", "2026-11-22"), BERLIN);
  expect(crossesMidnight(entry("2026-11-16T09:00:00.000Z", "2026-11-16T10:30:00.000Z"), week)).toBe(
    false,
  );
  // Sunday 22:00 to Monday 02:00 in Berlin, asked from the week that begins on Monday.
  expect(crossesMidnight(entry("2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z"), week)).toBe(
    true,
  );
  // 22:00 to midnight touches one day.
  expect(crossesMidnight(entry("2026-11-16T21:00:00.000Z", "2026-11-16T23:00:00.000Z"), week)).toBe(
    false,
  );
});

test("every day but the last gets its part cut down to the unit, the last the rest", () => {
  // 22:00:30 – 01:59:50 under "round up to 1 minute" counts 4:00: 1:59:30 lies before midnight.
  expect(divideOverDays([7170, 7190], minutes(240), 60)).toEqual([minutes(119), minutes(121)]);
  // Under Exact the unit is a second, so nothing is cut.
  expect(divideOverDays([7170, 7190], 14_360, 1)).toEqual([7170, 7190]);
  // Rounding down counts less than lies on the first day: the first day gets what there is.
  expect(divideOverDays([minutes(90), minutes(10)], minutes(60), 60)).toEqual([minutes(60), 0]);
});

test("a Project Share is divided over the days: each day by the shares, the rest to the Lead Project, the last day what is left", () => {
  // 1:30 and 1:30 for A and B in equal parts: each project gets half of each day.
  expect(divideProjectShares([minutes(90), minutes(90)], [minutes(90), minutes(90)], 60)).toEqual([
    [minutes(45), minutes(45)],
    [minutes(45), minutes(45)],
  ]);
  // 0:23 over 0:11 and 0:12, A 0:12 and B 0:11: day one gives B 0:05, A the rest of it.
  expect(divideProjectShares([minutes(11), minutes(12)], [minutes(12), minutes(11)], 60)).toEqual([
    [minutes(6), minutes(5)],
    [minutes(6), minutes(6)],
  ]);
  // Three projects of 0:01 over 0:02 and 0:01: the first day's rest fills A, then B.
  expect(
    divideProjectShares([minutes(2), minutes(1)], [minutes(1), minutes(1), minutes(1)], 60),
  ).toEqual([
    [minutes(1), minutes(1), 0],
    [0, 0, minutes(1)],
  ]);
});

test("the stretches resolution's example: 22:00 – 02:00 with a Rest Break of 23:30 – 00:30 counts 1:30 on each day", () => {
  const rest: Break = {
    timeKind: "rest_break",
    startedAt: instant("2026-11-16T22:30:00.000Z"),
    endedAt: instant("2026-11-16T23:30:00.000Z"),
    changedByLimit: false,
  };
  const measuredTime = entry("2026-11-16T21:00:00.000Z", "2026-11-17T01:00:00.000Z");
  const rule: RoundingRule = { kind: "ordinary", direction: "up", minutes: 1 };
  const input = { timeKind: "work" as const, measuredTime, timeZone: BERLIN, rule, breaks: [rest] };
  const computed = computeTimeEntry({ ...input, projects: [{ weight: 2 }, { weight: 1 }] });
  const roundedTime = computed.roundedTime!;
  expect(
    divideOverItsDays(
      {
        roundedTime,
        bookedDuration: computed.bookedDuration,
        projectShares: computed.projectShares,
        counted: countedRanges(input, roundedTime),
        unit: 60,
      },
      BERLIN,
    ),
  ).toEqual([
    { day: "2026-11-16", seconds: minutes(90), projectParts: [minutes(60), minutes(30)] },
    { day: "2026-11-17", seconds: minutes(90), projectParts: [minutes(60), minutes(30)] },
  ]);
});

test("under Block Rounding each day gets the Blocks that count on it, a Rest Break inside one with it", () => {
  // 22:10 – 00:10 in Berlin with a Rest Break of 22:20 – 23:50, Blocks of an hour: every Block
  // holds work, so 22:00 – 01:00 counts 3:00, 2:00 of it on Monday.
  const measuredTime = entry("2026-11-16T21:10:00.000Z", "2026-11-16T23:10:00.000Z");
  const breaks: Break[] = [
    {
      timeKind: "rest_break",
      startedAt: instant("2026-11-16T21:20:00.000Z"),
      endedAt: instant("2026-11-16T22:50:00.000Z"),
      changedByLimit: false,
    },
  ];
  const rule: RoundingRule = { kind: "block", minutes: 60 };
  const input = { timeKind: "work" as const, measuredTime, timeZone: BERLIN, rule, breaks };
  const computed = computeTimeEntry(input);
  const roundedTime = computed.roundedTime!;
  expect(computed.bookedDuration).toBe(minutes(180));
  expect(
    divideOverItsDays(
      {
        roundedTime,
        bookedDuration: computed.bookedDuration,
        projectShares: [],
        counted: countedRanges(input, roundedTime),
        unit: 60,
      },
      BERLIN,
    ),
  ).toEqual([
    { day: "2026-11-16", seconds: minutes(120), projectParts: [] },
    { day: "2026-11-17", seconds: minutes(60), projectParts: [] },
  ]);
});

// Generated entries: every kind of rule, valid breaks, several projects with Weights, and Time
// Zones of the entry and of the call that differ, some of them with offsets of no whole hours.

const parameters = { seed: 444, numRuns: 3000 };
const epoch = requireInstant("1970-01-01T00:00:00.000Z");
const instantOfSeconds = (seconds: number) => addDuration(epoch, durationSchema.parse(seconds));
// Whole seconds from 2020 to 2030.
const startSeconds = fc.integer({ min: 1_577_836_800, max: 1_893_456_000 });
const lengthSeconds = fc.oneof(
  fc.integer({ min: 3, max: 6 * 3600 }),
  fc.integer({ min: 3, max: 3 * 86_400 }),
);
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
const rule: fc.Arbitrary<RoundingRule> = fc.oneof(
  fc.constant({ kind: "exact" as const }),
  fc.record({
    kind: fc.constant("ordinary" as const),
    direction: fc.constantFrom(...ROUNDING_DIRECTIONS),
    minutes: fc.constantFrom(...ORDINARY_ROUNDING_MINUTES),
  }),
  fc.record({
    kind: fc.constant("block" as const),
    minutes: fc.constantFrom(...BLOCK_ROUNDING_MINUTES),
  }),
);
const timeKind = fc.oneof(
  { arbitrary: fc.constant<TimeKind>("work"), weight: 3 },
  { arbitrary: fc.constantFrom<TimeKind>(...NOT_WORK_KINDS), weight: 1 },
);

/** Breaks that keep the rules: their borders are distinct seconds inside the entry, in pairs. */
const validBreaks = (start: number, length: number) =>
  fc
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
    });

const generatedEntry = fc.tuple(startSeconds, lengthSeconds).chain(([start, length]) =>
  fc.record({
    timeKind,
    measuredTime: fc.constant({
      start: instantOfSeconds(start),
      end: instantOfSeconds(start + length),
    }),
    breaks: validBreaks(start, length),
    rule,
    entryZone: timeZone,
    callZone: timeZone,
    weights: fc.array(fc.integer({ min: 1, max: 10_000 }), { maxLength: 4 }),
  }),
);

type Sample = typeof generatedEntry extends fc.Arbitrary<infer Value> ? Value : never;

/** A generated entry as the Query divides it, or `null` when it counts no Rounded Time. */
function divided(sample: Sample) {
  const work = sample.timeKind === "work";
  const input = {
    timeKind: sample.timeKind,
    measuredTime: sample.measuredTime,
    timeZone: sample.entryZone,
    rule: sample.rule,
    breaks: work ? sample.breaks : [],
  };
  const computed = computeTimeEntry({
    ...input,
    projects: work ? sample.weights.map((weight) => ({ weight })) : [],
  });
  const { roundedTime } = computed;
  if (roundedTime === null) return null;
  const unit = sample.rule.kind === "exact" ? 1 : 60;
  const shares = divideOverItsDays(
    {
      roundedTime,
      bookedDuration: computed.bookedDuration,
      projectShares: computed.projectShares,
      counted: countedRanges(input, roundedTime),
      unit,
    },
    sample.callZone,
  );
  return { computed, shares, unit };
}

test("the Day Shares add up to the Booked Duration, lie on the unit and are never below zero", () => {
  fc.assert(
    fc.property(generatedEntry, (sample) => {
      const result = divided(sample);
      if (result === null) return;
      const { computed, shares, unit } = result;
      expect(shares.reduce((sum, { seconds }) => sum + seconds, 0)).toBe(computed.bookedDuration);
      for (const { seconds } of shares) {
        expect(seconds).toBeGreaterThanOrEqual(0);
        expect(seconds % unit).toBe(0);
      }
      // A Rest Break entry and Leisure count 0 on every day.
      if (sample.timeKind === "rest_break" || sample.timeKind === "leisure")
        expect(shares.every(({ seconds }) => seconds === 0)).toBe(true);
    }),
    parameters,
  );
});

test("the parts of the Project Shares add up per day to the Day Share and per project to the Project Share, never below zero", () => {
  fc.assert(
    fc.property(generatedEntry, (sample) => {
      const result = divided(sample);
      if (result === null) return;
      const { computed, shares, unit } = result;
      for (const { seconds, projectParts } of shares) {
        expect(projectParts).toHaveLength(computed.projectShares.length);
        if (projectParts.length > 0)
          expect(projectParts.reduce((sum, part) => sum + part, 0)).toBe(seconds);
        for (const part of projectParts) {
          expect(part).toBeGreaterThanOrEqual(0);
          expect(part % unit).toBe(0);
        }
      }
      for (const [project, share] of computed.projectShares.entries())
        expect(
          shares.reduce((sum, { projectParts }) => sum + (projectParts[project] ?? 0), 0),
        ).toBe(share);
    }),
    parameters,
  );
});

test("without Rest Breaks under Exact each day gets exactly the seconds of the entry on it", () => {
  fc.assert(
    fc.property(generatedEntry, (sample) => {
      fc.pre(sample.timeKind === "work");
      const result = divided({ ...sample, rule: { kind: "exact" }, breaks: [] });
      if (result === null) return;
      const { shares } = result;
      const days = dayRangesOf(span(shares[0]!.day, shares.at(-1)!.day), sample.callZone);
      for (const [index, { seconds }] of shares.entries()) {
        const day = days[index]!;
        const from = Math.max(epochMsOf(day.start), epochMsOf(sample.measuredTime.start));
        const to = Math.min(epochMsOf(day.end), epochMsOf(sample.measuredTime.end));
        expect(seconds).toBe((to - from) / 1000);
      }
    }),
    parameters,
  );
});
