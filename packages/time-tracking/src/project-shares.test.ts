// The Project Shares of the computation: the examples of the resolution "Several projects on one
// Time Entry" (#404) as single cases, and the division as a property with generated data.

import { addDuration, durationSchema, type Instant, resolveTimeZone } from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import fc from "fast-check";
import { describe, expect, test } from "vite-plus/test";
import {
  BLOCK_ROUNDING_MINUTES,
  computeTimeEntry,
  ORDINARY_ROUNDING_MINUTES,
  ROUNDING_DIRECTIONS,
  type RoundingRule,
  WEIGHT_MAX,
} from "./contracts/index.ts";

const berlin = resolveTimeZone("Europe/Berlin").timeZone;
const UP_TO_A_MINUTE: RoundingRule = { kind: "ordinary", direction: "up", minutes: 1 };

/** An Instant from a wall-clock text in Berlin on 2 March 2026, which runs on UTC+1. */
function berlinAt(clock: string): Instant {
  const [hours = 0, minutes = 0, seconds = 0] = clock.split(":").map(Number);
  return addDuration(
    requireInstant("2026-03-01T23:00:00.000Z"),
    durationSchema.parse(hours * 3600 + minutes * 60 + seconds),
  );
}

function sharesOf(
  [start, end]: readonly [string, string],
  rule: RoundingRule,
  weights: readonly number[],
) {
  return computeTimeEntry({
    measuredTime: { start: berlinAt(start), end: berlinAt(end) },
    timeZone: berlin,
    rule,
    breaks: [],
    projects: weights.map((weight) => ({ weight })),
  }).projectShares;
}

const clock = (text: string) => {
  const [hours = 0, minutes = 0, seconds = 0] = text.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

describe("the three divisions of 0:23", () => {
  test.each<[string, number[], string[]]>([
    ["A, B equal", [1, 1], ["0:12", "0:11"]],
    ["A, B, C equal", [1, 1, 1], ["0:09", "0:07", "0:07"]],
    ["A 50 %, B 30 %, C 20 %", [50, 30, 20], ["0:13", "0:06", "0:04"]],
  ])("%s", (_, weights, shares) => {
    expect(sharesOf(["10:07:30", "10:29:50"], UP_TO_A_MINUTE, weights)).toEqual(shares.map(clock));
  });
});

test("a share can be 0:00: an entry that counts 0:01 for three projects", () => {
  expect(sharesOf(["10:00:00", "10:00:40"], UP_TO_A_MINUTE, [1, 1, 1])).toEqual([60, 0, 0]);
});

test("the Lead Project table: A rounds up to 15 minutes, B is Exact", () => {
  const timer = ["10:07:30", "10:29:50"] as const;
  expect(sharesOf(timer, { kind: "ordinary", direction: "up", minutes: 15 }, [1, 1])).toEqual([
    clock("0:15"),
    clock("0:15"),
  ]);
  expect(sharesOf(timer, { kind: "exact" }, [1, 1])).toEqual([clock("0:11:10"), clock("0:11:10")]);
});

test("an entry without a project has no shares, and one project holds the whole Booked Duration", () => {
  expect(sharesOf(["10:07:30", "10:29:50"], UP_TO_A_MINUTE, [])).toEqual([]);
  expect(sharesOf(["10:07:30", "10:29:50"], UP_TO_A_MINUTE, [7])).toEqual([clock("0:23")]);
});

const epoch = requireInstant("1970-01-01T00:00:00.000Z");
const rule = fc.oneof(
  fc.constant<RoundingRule>({ kind: "exact" }),
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

test("the Project Shares add up to the Booked Duration exactly, none below zero, each further one on its unit", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 631152000, max: 4102444800 }),
      fc.integer({ min: 1, max: 2 * 86400 }),
      rule,
      fc.array(fc.integer({ min: 1, max: WEIGHT_MAX }), { maxLength: 12 }),
      (start, length, chosen, weights) => {
        const { bookedDuration, projectShares } = computeTimeEntry({
          measuredTime: {
            start: addDuration(epoch, durationSchema.parse(start)),
            end: addDuration(epoch, durationSchema.parse(start + length)),
          },
          timeZone: berlin,
          rule: chosen,
          breaks: [],
          projects: weights.map((weight) => ({ weight })),
        });
        expect(projectShares).toHaveLength(weights.length);
        if (weights.length === 0) return;
        expect(projectShares.reduce((sum, share) => sum + share, 0)).toBe(bookedDuration);
        for (const share of projectShares) expect(share).toBeGreaterThanOrEqual(0);
        const unit = chosen.kind === "exact" ? 1 : 60;
        for (const share of projectShares.slice(1)) expect(share % unit).toBe(0);
      },
    ),
    { seed: 441441, numRuns: 5000 },
  );
});
