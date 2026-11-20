import { describe, expect, test } from "vite-plus/test";
import {
  calendarDayFromText,
  calendarDayText,
  calendarLabels,
  clockFormatOf,
  calendarDaySchema,
  type CalendarDay,
} from "./index.ts";

const day = (text: string): CalendarDay => calendarDaySchema.parse(text);

describe("the text of a Calendar Day in a field", () => {
  test.each([
    ["de", "2026-11-05", "05.11.2026"],
    ["en", "2026-11-05", "11/05/2026"],
    ["de", "1000-01-01", "01.01.1000"],
  ] as const)("in %s, %s shows as %s", (locale, value, text) => {
    expect(calendarDayText(day(value), locale)).toBe(text);
  });

  test.each(["de", "en"])("what it shows in %s reads back as the same day", (locale) => {
    for (const value of ["2026-11-05", "2024-02-29", "9999-12-31"]) {
      expect(calendarDayFromText(calendarDayText(day(value), locale), locale)).toBe(value);
    }
  });
});

describe("a typed Calendar Day", () => {
  test.each([
    ["de", "5.11.2026", "2026-11-05"],
    ["de", " 05.11.2026 ", "2026-11-05"],
    ["de", "5.11.26", "2026-11-05"],
    ["de", "5/11/2026", "2026-11-05"],
    ["en", "11/5/2026", "2026-11-05"],
    ["en", "11.5.26", "2026-11-05"],
    ["de", "2026-11-05", "2026-11-05"],
    ["en", "2026-11-05", "2026-11-05"],
  ] as const)("in %s, %j is %s", (locale, text, expected) => {
    expect(calendarDayFromText(text, locale)).toBe(expected);
  });

  test.each([
    ["half a date", "de", "5.11."],
    ["a day the month lacks", "de", "31.02.2026"],
    ["a month that is none", "de", "05.13.2026"],
    ["the German order in English", "en", "25.11.2026"],
    ["a year before 1000", "de", "05.11.0999"],
    ["a three-digit year", "de", "05.11.202"],
    ["four parts", "de", "05.11.2026.1"],
    ["letters", "de", "5. Nov 2026"],
    ["nothing", "de", ""],
    ["an ISO day that does not exist", "de", "2026-02-30"],
  ] as const)("%s is no day: %s %j", (_case, locale, text) => {
    expect(calendarDayFromText(text, locale)).toBeNull();
  });
});

describe("the labels of a calendar picker", () => {
  test.each([
    ["de", "November 2026", "Do", "Nov", "2026", "Donnerstag, 5. November 2026"],
    ["en", "November 2026", "Thu", "Nov", "2026", "Thursday, November 5, 2026"],
  ] as const)("in %s", (locale, month, weekday, monthShort, year, full) => {
    const labels = calendarLabels(locale);
    const thursday = day("2026-11-05");

    expect(labels.month(thursday)).toBe(month);
    expect(labels.weekday(thursday)).toBe(weekday);
    expect(labels.monthShort(thursday)).toBe(monthShort);
    expect(labels.year(thursday)).toBe(year);
    expect(labels.day(thursday)).toBe(full);
  });

  test("name the day of the Calendar Day, not of the device's zone", () => {
    // The first day of a year and the last of the one before, read at UTC midnight anywhere.
    expect(calendarLabels("en").day(day("2027-01-01"))).toBe("Friday, January 1, 2027");
    expect(calendarLabels("en").day(day("2026-12-31"))).toBe("Thursday, December 31, 2026");
  });

  test("are kept per language: a second call gives the same object", () => {
    expect(calendarLabels("de")).toBe(calendarLabels("de"));
    expect(calendarLabels("de")).not.toBe(calendarLabels("en"));
  });
});

describe("the clock of a time picker", () => {
  test.each([
    ["de", "24h"],
    ["en", "12h"],
  ] as const)("in %s shows %s", (locale, format) => {
    expect(clockFormatOf(locale)).toBe(format);
  });
});
