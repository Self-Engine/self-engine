import { expect, test } from "vite-plus/test";
import { formatUtcOffset, repeatedOffsetOf, resolveTimeZone } from "./index.ts";
import { requireInstant } from "./testing.ts";

const berlin = resolveTimeZone("Europe/Berlin").timeZone;

test.each([
  ["+01:00", "UTC+1"],
  ["+02:00", "UTC+2"],
  ["-03:30", "UTC-3:30"],
  ["+05:45", "UTC+5:45"],
  ["+00:00", "UTC+0"],
  ["-00:00", "UTC+0"],
  // An offset with seconds, as some historic zones have, is shown to the nearest minute.
  ["+00:19:32", "UTC+0:20"],
])("the offset %s reads %s, as in the Time Zone picker", (offset, text) => {
  expect(formatUtcOffset(offset)).toBe(text);
});

test("text that is no offset is refused", () => {
  expect(() => formatUtcOffset("01:00")).toThrow(RangeError);
});

test.each([
  // Berlin's clocks go back on 25 October 2026 at 03:00: 02:00–02:59 shows twice.
  ["2026-10-25T00:30:00.000Z", "+02:00"],
  ["2026-10-25T01:30:45.000Z", "+01:00"],
  ["2026-10-25T00:00:00.000Z", "+02:00"],
  ["2026-10-25T01:59:59.000Z", "+01:00"],
])("%s shows a wall-clock time Berlin has twice, at %s", (instant, offset) => {
  expect(repeatedOffsetOf(requireInstant(instant), berlin)).toBe(offset);
});

test.each([
  "2026-10-24T23:59:00.000Z",
  "2026-10-25T02:00:00.000Z",
  "2027-03-28T01:00:00.000Z",
  "2026-11-13T12:30:00.000Z",
])("%s shows a wall-clock time Berlin has once", (instant) => {
  expect(repeatedOffsetOf(requireInstant(instant), berlin)).toBeNull();
});
