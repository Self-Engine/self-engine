import { expect, test } from "vite-plus/test";
import { calendarDaySchema, moveToDay, resolveTimeZone } from "./index.ts";
import { requireInstant } from "./testing.ts";

const { timeZone: berlin } = resolveTimeZone("Europe/Berlin");
const day = (text: string) => calendarDaySchema.parse(text);
const at = (text: string) => requireInstant(text);

test("an Instant moved to another day keeps its wall-clock time with seconds and milliseconds", () => {
  // 09:00:50.123 in Berlin on 13 November 2026.
  expect(moveToDay(at("2026-11-13T08:00:50.123Z"), day("2026-11-14"), berlin)).toEqual({
    case: "unambiguous",
    instant: "2026-11-14T08:00:50.123Z",
  });
  // To an earlier day as well.
  expect(moveToDay(at("2026-11-13T08:00:50.123Z"), day("2026-11-01"), berlin)).toEqual({
    case: "unambiguous",
    instant: "2026-11-01T08:00:50.123Z",
  });
});

test("across Berlin's autumn change the wall-clock time stays and the offset follows the day", () => {
  // 09:00:50 in summer time (+02:00) on 24 October 2026, moved to 26 October (+01:00).
  expect(moveToDay(at("2026-10-24T07:00:50.000Z"), day("2026-10-26"), berlin)).toEqual({
    case: "unambiguous",
    instant: "2026-10-26T08:00:50.000Z",
  });
});

test("across Berlin's spring change the wall-clock time stays and the offset follows the day", () => {
  // 09:00:50 in winter time (+01:00) on 27 March 2027, moved to 29 March (+02:00).
  expect(moveToDay(at("2027-03-27T08:00:50.000Z"), day("2027-03-29"), berlin)).toEqual({
    case: "unambiguous",
    instant: "2027-03-29T07:00:50.000Z",
  });
});

test("a time the clocks skip on the new day is skipped", () => {
  // 02:30:15 on 27 March 2027, moved to 28 March, where 02:00–02:59 does not exist.
  expect(moveToDay(at("2027-03-27T01:30:15.000Z"), day("2027-03-28"), berlin)).toEqual({
    case: "skipped",
  });
});

test("a time the new day shows twice follows resolveWallClockTime, with its seconds", () => {
  // 02:30:15 on 24 October 2026 (+02:00), moved to 25 October, where 02:00–02:59 shows twice.
  const halfPastTwo = at("2026-10-24T00:30:15.000Z");
  expect(moveToDay(halfPastTwo, day("2026-10-25"), berlin)).toEqual({
    case: "repeated",
    instant: "2026-10-25T00:30:15.000Z",
    occurrence: "earlier",
  });
  // A lower bound at or after the earlier occurrence selects the later one.
  expect(
    moveToDay(halfPastTwo, day("2026-10-25"), berlin, {
      lowerBound: at("2026-10-25T00:30:00.000Z"),
    }),
  ).toEqual({ case: "repeated", instant: "2026-10-25T01:30:15.000Z", occurrence: "later" });
  // On an edit, the occurrence nearest the previous Instant: here the day after, so the later one.
  expect(
    moveToDay(halfPastTwo, day("2026-10-25"), berlin, { previous: at("2026-10-26T01:30:15.000Z") }),
  ).toEqual({ case: "repeated", instant: "2026-10-25T01:30:15.000Z", occurrence: "later" });
});

test("the second occurrence of a repeated time moved to an ordinary day keeps its seconds", () => {
  // The second 02:40:30 of 25 October 2026 (+01:00), moved to 26 October (+01:00).
  expect(moveToDay(at("2026-10-25T01:40:30.000Z"), day("2026-10-26"), berlin)).toEqual({
    case: "unambiguous",
    instant: "2026-10-26T01:40:30.000Z",
  });
});
