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
import {
  type Break,
  BREAK_NOT_BETWEEN_WORK,
  BREAK_OVERLAPS,
  BREAK_TOO_SHORT,
  computeTimeEntry,
  NOT_WORK_HAS_BREAKS,
  NOT_WORK_HAS_PROJECTS,
  type RoundingRule,
  type TimeKind,
} from "./contracts/index.ts";

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
    timeKind: "work",
    measuredTime: { start: berlinAt(start), end: berlinAt(end) },
    timeZone,
    rule,
    breaks: [],
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
      findings: [],
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
      findings: [],
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
      findings: [],
      projectShares: [],
    });
  });

  test("a result of 0:00 gives no Rounded Time: 40 seconds rounded down to 15 minutes", () => {
    const rule: RoundingRule = { kind: "ordinary", direction: "down", minutes: 15 };
    expect(compute("10:07:00", "10:07:40", rule)).toEqual({
      roundedTime: null,
      bookedDuration: 0,
      findings: [],
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
        timeKind: "work",
        measuredTime: {
          start: at("2026-03-02T04:22:30.000Z"),
          end: at("2026-03-02T04:44:50.000Z"),
        },
        timeZone: kathmandu,
        rule: { kind: "block", minutes: 60 },
        breaks: [],
      }),
    ).toEqual({
      roundedTime: { start: at("2026-03-02T04:15:00.000Z"), end: at("2026-03-02T05:15:00.000Z") },
      bookedDuration: minutes(60),
      findings: [],
      projectShares: [],
    });
  });

  test("an entry that ends on a border does not count the Block after it", () => {
    expect(compute("10:07:30", "10:30:00", { kind: "block", minutes: 15 })).toEqual({
      roundedTime: { start: berlinAt("10:00"), end: berlinAt("10:30") },
      bookedDuration: minutes(30),
      findings: [],
      projectShares: [],
    });
  });
});

describe("Occupied Time", () => {
  test("handing in no Occupied Time changes nothing", () => {
    const measuredTime = { start: berlinAt("10:07:30"), end: berlinAt("10:29:50") };
    const rule: RoundingRule = { kind: "ordinary", direction: "up", minutes: 15 };
    expect(
      computeTimeEntry({
        timeKind: "work",
        measuredTime,
        timeZone: berlin,
        rule,
        breaks: [],
        occupiedTime: [],
      }),
    ).toEqual(
      computeTimeEntry({ timeKind: "work", measuredTime, timeZone: berlin, rule, breaks: [] }),
    );
  });
});

const restBreak = (start: string, end: string) =>
  ({
    timeKind: "rest_break",
    startedAt: berlinAt(start),
    endedAt: berlinAt(end),
    changedByLimit: false,
  }) as const;
const shortBreak = (start: string, end: string) =>
  ({ timeKind: "short_break", startedAt: berlinAt(start), endedAt: berlinAt(end) }) as const;

describe("breaks", () => {
  const upTo1: RoundingRule = { kind: "ordinary", direction: "up", minutes: 1 };

  test("the rounding resolution's example: 9:00:10 – 12:40:20 with a Rest Break of 20:25 is 9:00 – 12:40 and counts 3:20", () => {
    expect(
      computeTimeEntry({
        timeKind: "work",
        measuredTime: { start: berlinAt("09:00:10"), end: berlinAt("12:40:20") },
        timeZone: berlin,
        rule: upTo1,
        breaks: [restBreak("10:30:00", "10:50:25")],
      }),
    ).toEqual({
      roundedTime: { start: berlinAt("09:00"), end: berlinAt("12:40") },
      bookedDuration: minutes(200),
      findings: [],
      projectShares: [],
    });
  });

  const entry = (breaks: readonly Break[], rule: RoundingRule = { kind: "exact" }) =>
    computeTimeEntry({
      timeKind: "work",
      measuredTime: { start: berlinAt("09:00"), end: berlinAt("12:00") },
      timeZone: berlin,
      rule,
      breaks,
    });

  test("a Short Break counts, and a Rest Break of 20:25 is subtracted with its measured length", () => {
    expect(entry([shortBreak("10:00", "10:20")]).bookedDuration).toBe(minutes(180));
    expect(entry([restBreak("10:00:00", "10:20:25")]).bookedDuration).toBe(minutes(160) - 25);
  });

  test("Block Rounding does not count a Block that holds only a Rest Break", () => {
    // Blocks of 15 minutes: 10:00 – 10:30 holds only the Rest Break; 10:30 – 10:45 holds work.
    const rule: RoundingRule = { kind: "block", minutes: 15 };
    expect(entry([restBreak("09:59:30", "10:40:00")], rule)).toEqual({
      roundedTime: { start: berlinAt("09:00"), end: berlinAt("12:00") },
      bookedDuration: minutes(150),
      findings: [],
      projectShares: [],
    });
  });

  test("each broken rule names its break; a result stands all the same", () => {
    expect(
      entry([
        restBreak("09:00", "09:10"),
        restBreak("10:00", "10:30"),
        shortBreak("10:20", "10:40"),
        restBreak("11:00", "11:00"),
        shortBreak("11:50", "12:00"),
        restBreak("10:30", "10:35"),
      ]).findings,
    ).toEqual([
      { reason: BREAK_NOT_BETWEEN_WORK, breakIndex: 0 },
      { reason: BREAK_OVERLAPS, breakIndex: 2 },
      { reason: BREAK_TOO_SHORT, breakIndex: 3 },
      { reason: BREAK_NOT_BETWEEN_WORK, breakIndex: 4 },
      { reason: BREAK_OVERLAPS, breakIndex: 5 },
    ]);
  });

  test("breaks that touch keep the rules", () => {
    expect(entry([restBreak("10:00", "10:30"), shortBreak("10:30", "10:40")]).findings).toEqual([]);
  });

  test("reading is lenient: a break outside the entry is ignored, and overlapping breaks subtract each second once", () => {
    expect(
      entry([
        restBreak("07:00", "08:00"),
        restBreak("08:30", "09:10"),
        restBreak("10:00", "10:30"),
        restBreak("10:15", "10:45"),
      ]).bookedDuration,
    ).toBe(minutes(180 - 10 - 45));
  });
});

describe("an entry that is not work", () => {
  const upTo1: RoundingRule = { kind: "ordinary", direction: "up", minutes: 1 };
  const notWork = (
    timeKind: TimeKind,
    start: string,
    end: string,
    rule: RoundingRule = upTo1,
    parts: {
      readonly breaks?: readonly Break[];
      readonly projects?: readonly { weight: number }[];
    } = {},
  ) =>
    computeTimeEntry({
      timeKind,
      measuredTime: { start: berlinAt(start), end: berlinAt(end) },
      timeZone: berlin,
      rule,
      breaks: parts.breaks ?? [],
      ...(parts.projects !== undefined && { projects: parts.projects }),
    });

  test("the rounding resolution's Leisure Entry from a timer, 14:00:10 – 16:44:20, counts as 14:00 – 16:45 and books nothing", () => {
    expect(notWork("leisure", "14:00:10", "16:44:20")).toEqual({
      roundedTime: { start: berlinAt("14:00"), end: berlinAt("16:45") },
      bookedDuration: 0,
      findings: [],
      projectShares: [],
    });
  });

  test("a Short Break books the length of its Rounded Time, a Rest Break nothing", () => {
    expect(notWork("short_break", "10:00:10", "10:12:20")).toMatchObject({
      roundedTime: { start: berlinAt("10:00"), end: berlinAt("10:13") },
      bookedDuration: minutes(13),
    });
    expect(notWork("rest_break", "12:00:10", "12:44:20")).toMatchObject({
      roundedTime: { start: berlinAt("12:00"), end: berlinAt("12:45") },
      bookedDuration: 0,
    });
  });

  test("the rule rounds its length under every kind of rule", () => {
    expect(notWork("short_break", "10:07:30", "10:29:50", { kind: "exact" })).toMatchObject({
      roundedTime: { start: berlinAt("10:07:30"), end: berlinAt("10:29:50") },
      bookedDuration: minutes(22) + 20,
    });
    expect(
      notWork("leisure", "10:07:30", "10:29:50", { kind: "block", minutes: 15 }),
    ).toMatchObject({
      roundedTime: { start: berlinAt("10:00"), end: berlinAt("10:30") },
      bookedDuration: 0,
    });
  });

  test("a length rounded to 0:00 gives no Rounded Time", () => {
    const down: RoundingRule = { kind: "ordinary", direction: "down", minutes: 15 };
    expect(notWork("leisure", "10:00:00", "10:00:40", down).roundedTime).toBeNull();
    expect(notWork("short_break", "10:00:00", "10:00:40", down)).toMatchObject({
      roundedTime: null,
      bookedDuration: 0,
    });
  });

  test("breaks and projects are findings, ignored by the result", () => {
    expect(
      notWork("leisure", "14:00", "16:00", upTo1, {
        breaks: [restBreak("14:30", "15:00")],
        projects: [{ weight: 1 }],
      }),
    ).toEqual({
      roundedTime: { start: berlinAt("14:00"), end: berlinAt("16:00") },
      bookedDuration: 0,
      findings: [{ reason: NOT_WORK_HAS_BREAKS }, { reason: NOT_WORK_HAS_PROJECTS }],
      projectShares: [],
    });
  });
});
