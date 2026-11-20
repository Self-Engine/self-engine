import { expect, test } from "vite-plus/test";
import { repeatedTimeOffset, resolveTimeZone } from "./index.ts";
import { requireInstant } from "./testing.ts";
import { utcOffsetText } from "./utc-offset.ts";

const berlin = resolveTimeZone("Europe/Berlin").timeZone;
const newYork = resolveTimeZone("America/New_York").timeZone;

test.each([
  [60, "UTC+1"],
  [120, "UTC+2"],
  [-210, "UTC-3:30"],
  [345, "UTC+5:45"],
  [0, "UTC+0"],
  [-0, "UTC+0"],
  // An offset with seconds, as some historic zones have, is shown to the nearest minute.
  [19 + 32 / 60, "UTC+0:20"],
])("an offset of %s minutes reads %s, as in the Time Zone picker", (minutes, text) => {
  expect(utcOffsetText(minutes)).toBe(text);
});

test.each([
  // Berlin's clocks go back on 25 October 2026 at 03:00: 02:00–02:59 shows twice.
  ["2026-10-25T00:30:00.000Z", "UTC+2"],
  ["2026-10-25T01:30:45.000Z", "UTC+1"],
  ["2026-10-25T00:00:00.000Z", "UTC+2"],
  ["2026-10-25T01:59:59.000Z", "UTC+1"],
])("%s shows a wall-clock time Berlin has twice, at %s", (instant, offset) => {
  expect(repeatedTimeOffset(requireInstant(instant), berlin)).toBe(offset);
});

test("a repeated time in New York names a negative offset", () => {
  // New York's clocks go back on 1 November 2026 at 02:00: 01:00–01:59 shows twice.
  expect(repeatedTimeOffset(requireInstant("2026-11-01T05:30:00.000Z"), newYork)).toBe("UTC-4");
  expect(repeatedTimeOffset(requireInstant("2026-11-01T06:30:00.000Z"), newYork)).toBe("UTC-5");
});

test.each([
  "2026-10-24T23:59:00.000Z",
  "2026-10-25T02:00:00.000Z",
  "2027-03-28T01:00:00.000Z",
  "2026-11-13T12:30:00.000Z",
])("%s shows a wall-clock time Berlin has once", (instant) => {
  expect(repeatedTimeOffset(requireInstant(instant), berlin)).toBeNull();
});
