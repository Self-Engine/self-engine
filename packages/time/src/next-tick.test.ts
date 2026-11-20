import { describe, expect, test } from "vite-plus/test";
import { nextTick, startOfNextDay } from "./index.ts";
import { requireInstant } from "./testing.ts";
import { resolveTimeZone, type TimeZone } from "./zone.ts";

const at = requireInstant;
const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;

describe("the next tick of a step", () => {
  test.each([
    ["second", "2026-11-20T10:00:00.250Z", "2026-11-20T10:00:01.000Z"],
    ["second", "2026-11-20T10:00:00.999Z", "2026-11-20T10:00:01.000Z"],
    // A tick lies strictly after the moment, also on a full second.
    ["second", "2026-11-20T10:00:01.000Z", "2026-11-20T10:00:02.000Z"],
    ["second", "2026-12-31T23:59:59.500Z", "2027-01-01T00:00:00.000Z"],
    ["minute", "2026-11-20T10:00:00.000Z", "2026-11-20T10:01:00.000Z"],
    ["minute", "2026-11-20T10:00:59.999Z", "2026-11-20T10:01:00.000Z"],
    ["minute", "2026-11-20T23:59:30.000Z", "2026-11-21T00:00:00.000Z"],
  ] as const)("a %s after %s is %s", (step, now, next) => {
    expect(nextTick(at(now), step)).toBe(next);
  });

  // Every zone of today has an offset of whole minutes, so a full minute of UTC is a full minute
  // on its clocks: 15:45:30 in Kathmandu (+05:45) ticks at 15:46, 06:30:30 in St. John's (−03:30)
  // at 06:31.
  test.each([
    ["Asia/Kathmandu", "2026-11-20T10:00:30.000Z", "2026-11-20T10:01:00.000Z"],
    ["America/St_Johns", "2026-11-20T10:00:30.000Z", "2026-11-20T10:01:00.000Z"],
  ])("the next minute in %s is a full minute on its clocks", (_name, now, next) => {
    expect(nextTick(at(now), "minute")).toBe(next);
  });

  test("the last second of the supported years has no next tick", () => {
    expect(() => nextTick(at("9999-12-31T23:59:59.000Z"), "second")).toThrow(RangeError);
  });
});

describe("the start of the next day", () => {
  test.each([
    // East of UTC: Berlin is at +01:00 in November.
    ["Europe/Berlin", "2026-11-20T22:59:59.999Z", "2026-11-20T23:00:00.000Z"],
    ["Europe/Berlin", "2026-11-20T23:00:00.000Z", "2026-11-21T23:00:00.000Z"],
    ["Asia/Kathmandu", "2026-11-20T12:00:00.000Z", "2026-11-20T18:15:00.000Z"],
    // West of UTC: New York is at −05:00, so 23:59 on the 20th is 04:59 on the 21st in UTC.
    ["America/New_York", "2026-11-21T04:59:00.000Z", "2026-11-21T05:00:00.000Z"],
    ["America/New_York", "2026-11-21T05:00:00.000Z", "2026-11-22T05:00:00.000Z"],
  ])("in %s after %s is %s", (name, now, next) => {
    expect(startOfNextDay(at(now), zone(name))).toBe(next);
  });

  test.each([
    // Berlin springs forward on 2026-03-29: the day has 23 hours and the next starts at +02:00.
    ["Europe/Berlin", "2026-03-29T12:00:00.000Z", "2026-03-29T22:00:00.000Z"],
    // …and falls back on 2026-10-25: the day has 25 hours.
    ["Europe/Berlin", "2026-10-25T12:00:00.000Z", "2026-10-25T23:00:00.000Z"],
    // New York falls back on 2026-11-01 at 02:00.
    ["America/New_York", "2026-11-01T12:00:00.000Z", "2026-11-02T05:00:00.000Z"],
    // Santiago springs forward at midnight on 2026-09-06: that day starts at 01:00.
    ["America/Santiago", "2026-09-05T12:00:00.000Z", "2026-09-06T04:00:00.000Z"],
  ])("in %s across a clock change after %s is %s", (name, now, next) => {
    expect(startOfNextDay(at(now), zone(name))).toBe(next);
  });

  test("the last day of the supported years has no next day", () => {
    expect(() => startOfNextDay(at("9999-12-31T12:00:00.000Z"), zone("UTC"))).toThrow(RangeError);
  });
});
