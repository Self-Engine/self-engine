import { expect, test } from "vite-plus/test";
import {
  calendarDaySchema,
  resolveTimeZone,
  resolveWallClockTime,
  wallClockTimeSchema,
} from "./index.ts";
import { advanceInstantByMilliseconds, requireInstant } from "./testing.ts";

const { timeZone: berlin } = resolveTimeZone("Europe/Berlin");
const october = calendarDaySchema.parse("2026-10-25");
const halfPastTwo = wallClockTimeSchema.parse("02:30");

test("an unambiguous time keeps its meaning even when it precedes the lower bound", () => {
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("01:30"), berlin, {
      lowerBound: requireInstant("2026-10-25T00:00:00.000Z"),
    }),
  ).toEqual({
    case: "unambiguous",
    instant: "2026-10-24T23:30:00.000Z",
  });
});

test("Berlin's skipped 02:30 yields no Instant", () => {
  expect(resolveWallClockTime(calendarDaySchema.parse("2027-03-28"), halfPastTwo, berlin)).toEqual({
    case: "skipped",
  });
});

test("a new Berlin end at 02:30 after a start at 01:30 uses the earlier occurrence", () => {
  expect(
    resolveWallClockTime(october, halfPastTwo, berlin, {
      lowerBound: requireInstant("2026-10-24T23:30:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T00:30:00.000Z",
    occurrence: "earlier",
  });
});

test("a lower bound equal to the earlier occurrence selects the later one", () => {
  expect(
    resolveWallClockTime(october, halfPastTwo, berlin, {
      lowerBound: requireInstant("2026-10-25T00:30:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T01:30:00.000Z",
    occurrence: "later",
  });
});

test("editing Berlin's second 02:40 to 02:45 keeps the second occurrence", () => {
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("02:45"), berlin, {
      previous: requireInstant("2026-10-25T01:40:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T01:45:00.000Z",
    occurrence: "later",
  });
});

test("an edit from the second 02:00, as far from both 02:30, stays in the second hour", () => {
  expect(
    resolveWallClockTime(october, halfPastTwo, berlin, {
      previous: requireInstant("2026-10-25T01:00:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T01:30:00.000Z",
    occurrence: "later",
  });
});

test("editing Berlin's second 02:05 to 02:55 keeps the second hour, though the first 02:55 is nearer", () => {
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("02:55"), berlin, {
      previous: requireInstant("2026-10-25T01:05:00.000Z"),
      lowerBound: requireInstant("2026-10-25T00:55:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T01:55:00.000Z",
    occurrence: "later",
  });
});

test("editing Berlin's first 02:55 to 02:05 keeps the first hour, though the second 02:05 is nearer", () => {
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("02:05"), berlin, {
      previous: requireInstant("2026-10-25T00:55:30.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T00:05:00.000Z",
    occurrence: "earlier",
  });
});

test("an edit from outside the repeated hour takes the nearer occurrence", () => {
  const tenToThree = wallClockTimeSchema.parse("02:50");
  // From 03:10, after the repeated hour: the second 02:50 lies 20 minutes before it.
  expect(
    resolveWallClockTime(october, tenToThree, berlin, {
      previous: requireInstant("2026-10-25T02:10:00.000Z"),
    }),
  ).toEqual({ case: "repeated", instant: "2026-10-25T01:50:00.000Z", occurrence: "later" });
  // From 01:50, before it: the first 02:10 lies 20 minutes after it.
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("02:10"), berlin, {
      previous: requireInstant("2026-10-24T23:50:00.000Z"),
    }),
  ).toEqual({ case: "repeated", instant: "2026-10-25T00:10:00.000Z", occurrence: "earlier" });
});

test("03:00, the first moment after the repeated hour, is outside it", () => {
  // 03:00 shows once. The first 02:10 lies 110 minutes before it, the second 50.
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("02:10"), berlin, {
      previous: requireInstant("2026-10-25T02:00:00.000Z"),
    }),
  ).toEqual({ case: "repeated", instant: "2026-10-25T01:10:00.000Z", occurrence: "later" });
});

test("a half-hour change keeps a correction in its half hour", () => {
  // Lord Howe Island sets its clocks back by 30 minutes: 01:30 to 02:00 shows twice on 5 April 2026.
  const { timeZone: lordHowe } = resolveTimeZone("Australia/Lord_Howe");
  const day = calendarDaySchema.parse("2026-04-05");
  const first = resolveWallClockTime(day, wallClockTimeSchema.parse("01:35"), lordHowe);
  if (first.case !== "repeated") throw new Error("01:35 shows twice on that day");
  const second = advanceInstantByMilliseconds(first.instant, 30 * 60_000);
  expect(
    resolveWallClockTime(day, wallClockTimeSchema.parse("01:55"), lordHowe, { previous: second }),
  ).toMatchObject({ case: "repeated", occurrence: "later" });
  expect(
    resolveWallClockTime(day, wallClockTimeSchema.parse("01:55"), lordHowe, {
      previous: first.instant,
    }),
  ).toMatchObject({ case: "repeated", occurrence: "earlier" });
});

test("a new time in New York's repeated hour selects the earlier Instant and a negative offset", () => {
  const { timeZone: newYork } = resolveTimeZone("America/New_York");
  expect(
    resolveWallClockTime(
      calendarDaySchema.parse("2026-11-01"),
      wallClockTimeSchema.parse("01:30"),
      newYork,
    ),
  ).toEqual({
    case: "repeated",
    instant: "2026-11-01T05:30:00.000Z",
    occurrence: "earlier",
  });
});
