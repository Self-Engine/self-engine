import { expect, test } from "vite-plus/test";
import { durationBetween } from "./duration.ts";
import { formatRunningTime } from "./running-time.ts";
import { requireInstant } from "./testing.ts";

const START = requireInstant("2026-11-20T08:47:13.000Z");

test("the running time counts whole seconds from the start, with hours, minutes and seconds", () => {
  expect(formatRunningTime(START, requireInstant("2026-11-20T10:00:00.999Z"), "en")).toBe(
    "1:12:47",
  );
  expect(formatRunningTime(START, START, "de")).toBe("0:00:00");
  // A day and more keeps counting hours.
  expect(formatRunningTime(START, requireInstant("2026-11-21T10:47:13.000Z"), "en")).toBe(
    "26:00:00",
  );
});

test("the running time cuts both ends to whole seconds, as a Duration does", () => {
  const now = requireInstant("2026-11-20T08:47:14.200Z");
  const from = requireInstant("2026-11-20T08:47:13.900Z");
  expect(formatRunningTime(from, now, "en")).toBe("0:00:01");
  expect(durationBetween(from, now)).toBe(1);
});

test("a clock behind the start, after it jumped back, shows no time rather than a negative one", () => {
  expect(formatRunningTime(START, requireInstant("2026-11-20T07:00:00.000Z"), "en")).toBe(
    "0:00:00",
  );
});
