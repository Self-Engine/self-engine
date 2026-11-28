import { expect, test } from "vite-plus/test";
import {
  calendarDaySchema,
  durationSchema,
  formatCalendarDay,
  formatDuration,
  formatInstant,
  resolveTimeZone,
} from "./index.ts";
import { requireInstant } from "./testing.ts";

const zone = (name: string) => resolveTimeZone(name).timeZone;

// The words and digits are asserted exactly; which kind of space the runtime's language data puts
// between them (a narrow no-break space before "PM" in some versions) is not ours to pin.
const shown = (...args: Parameters<typeof formatInstant>): string =>
  formatInstant(...args).replace(/\s/gu, " ");

test.each([
  // A November afternoon: Berlin is an hour east of UTC, New York five hours west.
  ["en", "Europe/Berlin", "2026-11-13T12:30:00.000Z", "Nov 13, 2026, 1:30 PM"],
  ["en", "America/New_York", "2026-11-13T12:30:00.000Z", "Nov 13, 2026, 7:30 AM"],
  ["de", "Europe/Berlin", "2026-11-13T12:30:00.000Z", "13.11.2026, 13:30"],
  ["de", "America/New_York", "2026-11-13T12:30:00.000Z", "13.11.2026, 07:30"],
  // The last minute before Berlin's clocks go forward is still the 29th there, and the 28th in
  // New York; the seconds are cut, not rounded.
  ["en", "Europe/Berlin", "2026-03-29T00:59:59.999Z", "Mar 29, 2026, 1:59 AM"],
  ["en", "America/New_York", "2026-03-29T00:59:59.999Z", "Mar 28, 2026, 8:59 PM"],
  ["de", "Europe/Berlin", "2026-03-29T00:59:59.999Z", "29.03.2026, 01:59"],
  ["de", "America/New_York", "2026-03-29T00:59:59.999Z", "28.03.2026, 20:59"],
] as const)("dateTime in %s, %s: %s is %s", (locale, name, instant, expected) => {
  expect(shown(requireInstant(instant), "dateTime", locale, zone(name))).toBe(expected);
});

test("the zone decides the text, not the device's zone", () => {
  const instant = requireInstant("2026-11-13T23:30:00.000Z");

  expect(shown(instant, "dateTime", "de", zone("Asia/Bangkok"))).toBe("14.11.2026, 06:30");
  expect(shown(instant, "dateTime", "de", zone("Pacific/Honolulu"))).toBe("13.11.2026, 13:30");
});

test("a formatter is kept per locale, zone and format: a second call gives the same text", () => {
  const instant = requireInstant("2026-11-13T12:30:00.000Z");
  const berlin = zone("Europe/Berlin");

  expect(shown(instant, "dateTime", "de", berlin)).toBe("13.11.2026, 13:30");
  expect(shown(instant, "dateTime", "en", berlin)).toBe("Nov 13, 2026, 1:30 PM");
  expect(shown(instant, "dateTime", "de", berlin)).toBe("13.11.2026, 13:30");
});

test.each(["en", "de"])("hoursMinutes includes seconds only when needed in %s", (locale) => {
  expect(formatDuration(durationSchema.parse(0), "hoursMinutes", locale)).toBe("0:00");
  expect(formatDuration(durationSchema.parse(2_650), "hoursMinutes", locale)).toBe("0:44:10");
  expect(formatDuration(durationSchema.parse(300), "hoursMinutes", locale)).toBe("0:05");
  expect(formatDuration(durationSchema.parse(3_599), "hoursMinutes", locale)).toBe("0:59:59");
  expect(formatDuration(durationSchema.parse(95_400), "hoursMinutes", locale)).toBe("26:30");
  expect(
    formatDuration(durationSchema.parse(Number.MAX_SAFE_INTEGER), "hoursMinutes", locale),
  ).toBe("2501999792983:36:31");
});

test.each(["en", "de"])("hoursMinutesSeconds shows the running timer in %s", (locale) => {
  expect(formatDuration(durationSchema.parse(260), "hoursMinutesSeconds", locale)).toBe("0:04:20");
  expect(formatDuration(durationSchema.parse(3_860), "hoursMinutesSeconds", locale)).toBe(
    "1:04:20",
  );
  expect(formatDuration(durationSchema.parse(95_400), "hoursMinutesSeconds", locale)).toBe(
    "26:30:00",
  );
  expect(
    formatDuration(durationSchema.parse(Number.MAX_SAFE_INTEGER), "hoursMinutesSeconds", locale),
  ).toBe("2501999792983:36:31");
});

test("the duration digits follow the supplied locale", () => {
  expect(formatDuration(durationSchema.parse(260), "hoursMinutes", "de-u-nu-arab")).toBe("٠:٠٤:٢٠");
});

test.each([
  ["en", "Fri, Nov 13"],
  ["de", "Fr., 13. Nov."],
])("weekdayDate shows the weekday and date in %s", (locale, expected) => {
  const day = calendarDaySchema.parse("2026-11-13");

  expect(formatCalendarDay(day, "weekdayDate", locale).replace(/\s/gu, " ")).toBe(expected);
});

test.each([
  ["en", "11/13"],
  ["de", "13.11."],
])("shortDate shows a numeric date in %s", (locale, expected) => {
  const day = calendarDaySchema.parse("2026-11-13");

  expect(formatCalendarDay(day, "shortDate", locale)).toBe(expected);
});

test.each([
  ["en", "2026-11-13T12:30:45.000Z", "1:30 PM"],
  ["de", "2026-11-13T12:30:45.000Z", "13:30"],
  // The second 02:30 of Berlin's night of 25 October 2026 reads like the first.
  ["de", "2026-10-25T01:30:00.000Z", "02:30"],
] as const)("time in %s: %s is %s", (locale, instant, expected) => {
  expect(shown(requireInstant(instant), "time", locale, zone("Europe/Berlin"))).toBe(expected);
});
