import { expect, test } from "vite-plus/test";
import {
  calendarDaySchema,
  resolveTimeZone,
  resolveWallClockTime,
  wallClockTimeSchema,
} from "./index.ts";
import { requireInstant } from "./testing.ts";

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
    offset: "+02:00",
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
    offset: "+01:00",
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
    offset: "+01:00",
  });
});

test("an equally close edit keeps the previous occurrence's UTC offset", () => {
  expect(
    resolveWallClockTime(october, halfPastTwo, berlin, {
      previous: requireInstant("2026-10-25T01:00:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T01:30:00.000Z",
    occurrence: "later",
    offset: "+01:00",
  });
});

test("editing Berlin's second 02:05 to 02:55 picks the first 02:55, ten minutes earlier", () => {
  expect(
    resolveWallClockTime(october, wallClockTimeSchema.parse("02:55"), berlin, {
      previous: requireInstant("2026-10-25T01:05:00.000Z"),
      lowerBound: requireInstant("2026-10-25T00:55:00.000Z"),
    }),
  ).toEqual({
    case: "repeated",
    instant: "2026-10-25T00:55:00.000Z",
    occurrence: "earlier",
    offset: "+02:00",
  });
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
    offset: "-04:00",
  });
});
