import {
  addDuration,
  durationSchema,
  type Instant,
  instantSchema,
  resolveTimeZone,
  type TimeZone,
} from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import { describe, expect, test } from "vite-plus/test";
import { computeTimeEntry, type RoundingRule } from "./contracts/index.ts";

const zone = (name: string) => resolveTimeZone(name).timeZone;
const berlin = zone("Europe/Berlin");

/** An Instant from a wall-clock text in Berlin on 2 March 2026, which runs on UTC+1. */
function berlinAt(clock: string): Instant {
  const [hours = 0, minutes = 0, seconds = 0] = clock.split(":").map(Number);
  return addDuration(
    requireInstant("2026-03-01T23:00:00.000Z"),
    durationSchema.parse(hours * 3600 + minutes * 60 + seconds),
  );
}

function compute(start: string, end: string, rule: RoundingRule, timeZone: TimeZone = berlin) {
  return computeTimeEntry({
    measuredTime: { start: berlinAt(start), end: berlinAt(end) },
    timeZone,
    rule,
  });
}

const minutes = (value: number) => value * 60;

describe("the rounding resolution's table: a timer from 10:07:30 to 10:29:50", () => {
  test.each<[string, RoundingRule, [string, string], number]>([
    ["exact", { kind: "exact" }, ["10:07:30", "10:29:50"], minutes(22) + 20],
    [
      "round up to 1 minute",
      { kind: "ordinary", direction: "up", minutes: 1 },
      ["10:07", "10:30"],
      minutes(23),
    ],
    [
      "round up to 15 minutes",
      { kind: "ordinary", direction: "up", minutes: 15 },
      ["10:07", "10:37"],
      minutes(30),
    ],
    [
      "round down to 15 minutes",
      { kind: "ordinary", direction: "down", minutes: 15 },
      ["10:07", "10:22"],
      minutes(15),
    ],
    ["Blocks of 15 minutes", { kind: "block", minutes: 15 }, ["10:00", "10:30"], minutes(30)],
  ])("%s", (_, rule, [roundedStart, roundedEnd], bookedDuration) => {
    expect(compute("10:07:30", "10:29:50", rule)).toEqual({
      roundedTime: { start: berlinAt(roundedStart), end: berlinAt(roundedEnd) },
      bookedDuration,
      projectShares: [],
    });
  });
});

describe("Ordinary Rounding", () => {
  test("exactly half a step rounds up to the nearest step", () => {
    const rule: RoundingRule = { kind: "ordinary", direction: "nearest", minutes: 15 };
    expect(compute("10:00:00", "10:07:30", rule)).toEqual({
      roundedTime: { start: berlinAt("10:00"), end: berlinAt("10:15") },
      bookedDuration: minutes(15),
      projectShares: [],
    });
  });

  test("less than half a step rounds down to the nearest step", () => {
    const rule: RoundingRule = { kind: "ordinary", direction: "nearest", minutes: 15 };
    expect(compute("10:00:00", "10:07:29", rule).bookedDuration).toBe(0);
  });

  test("the start is cut to the whole minute before the Booked Duration is added", () => {
    const rule: RoundingRule = { kind: "ordinary", direction: "up", minutes: 1 };
    // A timer of 44:10 counts 0:45 (the seconds resolution).
    expect(compute("10:00:50", "10:45:00", rule)).toEqual({
      roundedTime: { start: berlinAt("10:00"), end: berlinAt("10:45") },
      bookedDuration: minutes(45),
      projectShares: [],
    });
  });

  test("a result of 0:00 gives no Rounded Time: 40 seconds rounded down to 15 minutes", () => {
    const rule: RoundingRule = { kind: "ordinary", direction: "down", minutes: 15 };
    expect(compute("10:07:00", "10:07:40", rule)).toEqual({
      roundedTime: null,
      bookedDuration: 0,
      projectShares: [],
    });
  });
});

describe("Block Rounding", () => {
  test("Blocks follow the clock of a Time Zone whose offset is no whole hour", () => {
    // 10:07:30 – 10:29:50 in Kathmandu (UTC+5:45) is 04:22:30 – 04:44:50 in UTC.
    const kathmandu = zone("Asia/Kathmandu");
    const at = (text: string) => instantSchema.parse(text);
    expect(
      computeTimeEntry({
        measuredTime: {
          start: at("2026-03-02T04:22:30.000Z"),
          end: at("2026-03-02T04:44:50.000Z"),
        },
        timeZone: kathmandu,
        rule: { kind: "block", minutes: 60 },
      }),
    ).toEqual({
      roundedTime: { start: at("2026-03-02T04:15:00.000Z"), end: at("2026-03-02T05:15:00.000Z") },
      bookedDuration: minutes(60),
      projectShares: [],
    });
  });

  test("an entry that ends on a border does not count the Block after it", () => {
    expect(compute("10:07:30", "10:30:00", { kind: "block", minutes: 15 })).toEqual({
      roundedTime: { start: berlinAt("10:00"), end: berlinAt("10:30") },
      bookedDuration: minutes(30),
      projectShares: [],
    });
  });
});

describe("Occupied Time", () => {
  test("handing in no Occupied Time changes nothing", () => {
    const measuredTime = { start: berlinAt("10:07:30"), end: berlinAt("10:29:50") };
    const rule: RoundingRule = { kind: "ordinary", direction: "up", minutes: 15 };
    expect(computeTimeEntry({ measuredTime, timeZone: berlin, rule, occupiedTime: [] })).toEqual(
      computeTimeEntry({ measuredTime, timeZone: berlin, rule }),
    );
  });
});
