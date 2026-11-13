import { durationBetween } from "../duration.ts";
import { instantSchema } from "../instant.ts";
import { calendarDaySchema, daySpanSchema, wallClockTimeSchema } from "../values.ts";
import {
  calendarDayOf,
  instantAt,
  instantRangeOf,
  startOfCalendarDay,
  today,
  wallClockTimeOf,
} from "../zoned.ts";
import { resolveTimeZone, type TimeZone } from "../zone.ts";
import type { CheckCase } from "./cases.ts";

// Ported from the old app's tests and extended: clock changes in both directions, the date line,
// month ends, leap days and the year limits. Every expected value is written out by hand.

function zone(name: string): TimeZone {
  const { timeZone, deviceFallback } = resolveTimeZone(name);
  if (deviceFallback) throw new Error(`This runtime does not know ${name}`);
  return timeZone;
}
const at = (text: string) => instantSchema.parse(text);
const day = (text: string) => calendarDaySchema.parse(text);
const time = (text: string) => wallClockTimeSchema.parse(text);
const rejected = { thrown: "RangeError" };

const dayAndTimeOf: Array<[string, string, string, string]> = [
  // [Instant, zone, day, wall-clock time]
  ["2026-05-15T00:30:00.000Z", "Europe/Berlin", "2026-05-15", "02:30"],
  ["2026-05-15T00:30:00.000Z", "America/New_York", "2026-05-14", "20:30"],
  // Offsets that are not whole hours.
  ["2026-01-01T10:14:59.999Z", "Pacific/Chatham", "2026-01-01", "23:59"],
  ["2026-01-01T10:15:00.000Z", "Pacific/Chatham", "2026-01-02", "00:00"],
  ["2026-01-01T18:29:00.000Z", "Asia/Kolkata", "2026-01-01", "23:59"],
  ["2026-01-01T18:30:00.000Z", "Asia/Kolkata", "2026-01-02", "00:00"],
  // One moment, two days on either side of the date line.
  ["2026-06-01T11:00:00.000Z", "Pacific/Kiritimati", "2026-06-02", "01:00"],
  ["2026-06-01T11:00:00.000Z", "Pacific/Pago_Pago", "2026-06-01", "00:00"],
  // Around the clock changes in Berlin, both directions.
  ["2026-03-29T00:59:59.999Z", "Europe/Berlin", "2026-03-29", "01:59"],
  ["2026-03-29T01:00:00.000Z", "Europe/Berlin", "2026-03-29", "03:00"],
  ["2026-10-25T00:30:00.000Z", "Europe/Berlin", "2026-10-25", "02:30"],
  ["2026-10-25T01:30:00.000Z", "Europe/Berlin", "2026-10-25", "02:30"],
  // Month ends and leap days.
  ["2026-01-31T23:30:00.000Z", "Europe/Berlin", "2026-02-01", "00:30"],
  ["2026-03-01T04:59:00.000Z", "America/New_York", "2026-02-28", "23:59"],
  ["2024-02-28T23:30:00.000Z", "Asia/Tokyo", "2024-02-29", "08:30"],
  ["2024-02-29T23:30:00.000Z", "Asia/Tokyo", "2024-03-01", "08:30"],
  ["2025-12-31T23:59:59.999Z", "UTC", "2025-12-31", "23:59"],
  // The year limits.
  ["1000-01-01T00:00:00.000Z", "UTC", "1000-01-01", "00:00"],
  ["9999-12-31T23:59:59.999Z", "UTC", "9999-12-31", "23:59"],
];

const instantsAt: Array<[string, string, string, unknown]> = [
  // [day, wall-clock time, zone, result]
  [
    "2026-03-30",
    "14:15",
    "Europe/Berlin",
    { case: "unambiguous", instant: "2026-03-30T12:15:00.000Z" },
  ],
  [
    "2026-03-28",
    "14:15",
    "Europe/Berlin",
    { case: "unambiguous", instant: "2026-03-28T13:15:00.000Z" },
  ],
  // Spring forward: 02:30 does not exist and moves on by the gap to 03:30.
  [
    "2026-03-29",
    "02:30",
    "Europe/Berlin",
    { case: "skipped", instant: "2026-03-29T01:30:00.000Z" },
  ],
  [
    "2024-03-10",
    "02:30",
    "America/New_York",
    { case: "skipped", instant: "2024-03-10T07:30:00.000Z" },
  ],
  [
    "2026-10-04",
    "02:15",
    "Australia/Lord_Howe",
    { case: "skipped", instant: "2026-10-03T15:45:00.000Z" },
  ],
  [
    "2026-09-06",
    "00:30",
    "America/Santiago",
    { case: "skipped", instant: "2026-09-06T04:30:00.000Z" },
  ],
  // Fall back: the time happens twice, the earlier Instant first.
  [
    "2026-10-25",
    "02:30",
    "Europe/Berlin",
    { case: "repeated", instant: "2026-10-25T00:30:00.000Z", later: "2026-10-25T01:30:00.000Z" },
  ],
  [
    "2024-11-03",
    "01:30",
    "America/New_York",
    { case: "repeated", instant: "2024-11-03T05:30:00.000Z", later: "2024-11-03T06:30:00.000Z" },
  ],
  [
    "2026-04-05",
    "03:00",
    "Pacific/Chatham",
    { case: "repeated", instant: "2026-04-04T13:15:00.000Z", later: "2026-04-04T14:15:00.000Z" },
  ],
  [
    "2026-04-05",
    "01:45",
    "Australia/Lord_Howe",
    { case: "repeated", instant: "2026-04-04T14:45:00.000Z", later: "2026-04-04T15:15:00.000Z" },
  ],
  // The edges of a clock change are ordinary times.
  [
    "2026-10-25",
    "03:00",
    "Europe/Berlin",
    { case: "unambiguous", instant: "2026-10-25T02:00:00.000Z" },
  ],
  [
    "2026-03-29",
    "03:00",
    "Europe/Berlin",
    { case: "unambiguous", instant: "2026-03-29T01:00:00.000Z" },
  ],
  // Date line, leap day, month end.
  [
    "2026-06-02",
    "01:00",
    "Pacific/Kiritimati",
    { case: "unambiguous", instant: "2026-06-01T11:00:00.000Z" },
  ],
  [
    "2024-02-29",
    "12:00",
    "Asia/Tokyo",
    { case: "unambiguous", instant: "2024-02-29T03:00:00.000Z" },
  ],
  [
    "2026-12-31",
    "23:59",
    "America/Los_Angeles",
    { case: "unambiguous", instant: "2027-01-01T07:59:00.000Z" },
  ],
  // The year limits: an Instant outside years 1000–9999 is refused.
  ["1000-01-01", "00:00", "UTC", { case: "unambiguous", instant: "1000-01-01T00:00:00.000Z" }],
  ["9999-12-31", "23:59", "UTC", { case: "unambiguous", instant: "9999-12-31T23:59:00.000Z" }],
  ["1000-01-01", "00:00", "Asia/Tokyo", rejected],
  ["9999-12-31", "23:59", "Pacific/Pago_Pago", rejected],
];

const startsOfDay: Array<[string, string, unknown]> = [
  ["2026-05-15", "Europe/Berlin", "2026-05-14T22:00:00.000Z"],
  // Cairo's clocks jump from 00:00 to 01:00, so the day starts at 01:00.
  ["2026-04-24", "Africa/Cairo", "2026-04-23T22:00:00.000Z"],
  // Santiago jumps from 00:00 to 01:00.
  ["2026-09-06", "America/Santiago", "2026-09-06T04:00:00.000Z"],
  // Samoa skipped 30 December 2011 when it moved across the date line.
  ["2011-12-30", "Pacific/Apia", "2011-12-30T10:00:00.000Z"],
  ["1000-01-01", "UTC", "1000-01-01T00:00:00.000Z"],
  ["1000-01-01", "Asia/Tokyo", rejected],
];

const ranges: Array<[string, string | [string, string], string, unknown]> = [
  // [name, day or [first, last], zone, range]
  [
    "an ordinary day",
    "2026-05-15",
    "Europe/Berlin",
    { start: "2026-05-14T22:00:00.000Z", end: "2026-05-15T22:00:00.000Z" },
  ],
  [
    "a 23-hour day",
    "2026-03-29",
    "Europe/Berlin",
    { start: "2026-03-28T23:00:00.000Z", end: "2026-03-29T22:00:00.000Z" },
  ],
  [
    "a 25-hour day",
    "2026-10-25",
    "Europe/Berlin",
    { start: "2026-10-24T22:00:00.000Z", end: "2026-10-25T23:00:00.000Z" },
  ],
  [
    "a day starting at 01:00",
    "2026-04-24",
    "Africa/Cairo",
    { start: "2026-04-23T22:00:00.000Z", end: "2026-04-24T21:00:00.000Z" },
  ],
  [
    "the day before a skipped day",
    "2011-12-29",
    "Pacific/Apia",
    { start: "2011-12-29T10:00:00.000Z", end: "2011-12-30T10:00:00.000Z" },
  ],
  [
    "a skipped day, which is empty",
    "2011-12-30",
    "Pacific/Apia",
    { start: "2011-12-30T10:00:00.000Z", end: "2011-12-30T10:00:00.000Z" },
  ],
  [
    "a month, both ends included",
    ["2026-11-01", "2026-11-30"],
    "Europe/Berlin",
    { start: "2026-10-31T23:00:00.000Z", end: "2026-11-30T23:00:00.000Z" },
  ],
  [
    "a leap February",
    ["2024-02-01", "2024-02-29"],
    "UTC",
    { start: "2024-02-01T00:00:00.000Z", end: "2024-03-01T00:00:00.000Z" },
  ],
  [
    "a year across the date line",
    ["2026-01-01", "2026-12-31"],
    "Pacific/Kiritimati",
    { start: "2025-12-31T10:00:00.000Z", end: "2026-12-31T10:00:00.000Z" },
  ],
  [
    "the first supported day",
    "1000-01-01",
    "UTC",
    { start: "1000-01-01T00:00:00.000Z", end: "1000-01-02T00:00:00.000Z" },
  ],
  ["the last supported day, whose end lies past year 9999", "9999-12-31", "UTC", rejected],
];

const todays: Array<[string, string, string]> = [
  // 22:30 UTC is already the next day in Berlin and Chatham, still the same day in Los Angeles.
  ["2026-10-23T22:30:00.000Z", "Europe/Berlin", "2026-10-24"],
  ["2026-10-23T22:30:00.000Z", "America/Los_Angeles", "2026-10-23"],
  ["2026-10-23T22:30:00.000Z", "Pacific/Chatham", "2026-10-24"],
  ["2026-10-23T22:30:00.000Z", "UTC", "2026-10-23"],
];

export const fixedCases: readonly CheckCase[] = [
  ...dayAndTimeOf.map(([instant, name, expectedDay, expectedTime]) => ({
    name: `${instant} is ${expectedDay} ${expectedTime} in ${name}`,
    actual: () => [
      calendarDayOf(at(instant), zone(name)),
      wallClockTimeOf(at(instant), zone(name)),
    ],
    expected: [expectedDay, expectedTime],
  })),
  ...[
    ["1000-01-01T00:00:00.000Z", "America/New_York"],
    ["9999-12-31T23:59:59.999Z", "Pacific/Kiritimati"],
  ].map(([instant, name]) => ({
    name: `${instant} has no supported day in ${name}`,
    actual: () => calendarDayOf(at(instant!), zone(name!)),
    expected: rejected,
  })),
  ...instantsAt.map(([d, t, name, expected]) => ({
    name: `${d} ${t} in ${name}`,
    actual: () => instantAt(day(d), time(t), zone(name)),
    expected,
  })),
  {
    name: "a day and time round-trip through the Instant in Chatham",
    actual: () => {
      const { instant } = instantAt(day("2026-07-01"), time("23:45"), zone("Pacific/Chatham"));
      return [
        calendarDayOf(instant, zone("Pacific/Chatham")),
        wallClockTimeOf(instant, zone("Pacific/Chatham")),
      ];
    },
    expected: ["2026-07-01", "23:45"],
  },
  ...startsOfDay.map(([d, name, expected]) => ({
    name: `${d} starts at ${JSON.stringify(expected)} in ${name}`,
    actual: () => startOfCalendarDay(day(d), zone(name)),
    expected,
  })),
  ...ranges.map(([label, days, name, expected]) => ({
    name: `the range of ${label} in ${name}`,
    actual: () =>
      instantRangeOf(
        typeof days === "string"
          ? day(days)
          : daySpanSchema.parse({ first: days[0], last: days[1] }),
        zone(name),
      ),
    expected,
  })),
  {
    name: "the skipped 02:30 in Berlin on 29 March 2026 shows as 03:30",
    actual: () => {
      const berlin = zone("Europe/Berlin");
      return wallClockTimeOf(instantAt(day("2026-03-29"), time("02:30"), berlin).instant, berlin);
    },
    expected: "03:30",
  },
  {
    name: "24 April 2026 in Cairo starts at 01:00 on the clock",
    actual: () => {
      const cairo = zone("Africa/Cairo");
      return wallClockTimeOf(startOfCalendarDay(day("2026-04-24"), cairo), cairo);
    },
    expected: "01:00",
  },
  {
    name: "24 April 2026 in Cairo lasts 23 hours",
    actual: () => {
      const { start, end } = instantRangeOf(day("2026-04-24"), zone("Africa/Cairo"));
      return durationBetween(start, end);
    },
    expected: 23 * 3600,
  },
  {
    // Known limit (ADR 0026): until 2010 St. Johns turned the clock back from 00:01 to 23:01 of
    // the day before, so 24 October 1987 resumed after its range had ended. One range per day
    // leaves the Instant of 23:30 outside the range of the day it falls on.
    name: "known limit: 1987-10-25T03:00Z is 24 October, 23:30, in St. Johns, after that day's range",
    actual: () => {
      const stJohns = zone("America/St_Johns");
      const instant = at("1987-10-25T03:00:00.000Z");
      return [
        calendarDayOf(instant, stJohns),
        wallClockTimeOf(instant, stJohns),
        instantRangeOf(day("1987-10-24"), stJohns),
      ];
    },
    expected: [
      "1987-10-24",
      "23:30",
      { start: "1987-10-24T02:30:00.000Z", end: "1987-10-25T02:30:00.000Z" },
    ],
  },
  ...todays.map(([instant, name, expected]) => ({
    name: `today at ${instant} in ${name} is ${expected}`,
    actual: () => today(() => at(instant), zone(name)),
    expected,
  })),
];
