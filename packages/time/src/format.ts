// Views pick a display format by name and pass the App Language. Only an Instant needs a zone.

import { epochMsOf } from "./borders.ts";
import type { Instant } from "./instant.ts";
import type { CalendarDay, Duration } from "./values.ts";
import type { TimeZone } from "./zone.ts";

const INSTANT_FORMATS = {
  /** Date and time of day, such as `Nov 13, 2026, 1:30 PM` or `13.11.2026, 13:30`. */
  dateTime: { dateStyle: "medium", timeStyle: "short" },
  /** The time of day alone, such as `1:30 PM` or `13:30`. */
  time: { timeStyle: "short" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** The name of a display format for an Instant. */
export type InstantFormat = keyof typeof INSTANT_FORMATS;

const CALENDAR_DAY_FORMATS = {
  /** Abbreviated weekday and date without the year, such as `Fri, Nov 13`. */
  weekdayDate: { weekday: "short", month: "short", day: "numeric" },
  /** Numeric month and day, such as `11/13` or `13.11.`. */
  shortDate: { month: "numeric", day: "numeric" },
  /** What a date field shows and reads back, such as `11/05/2026` or `05.11.2026`. */
  fieldDate: { day: "2-digit", month: "2-digit", year: "numeric" },
  /** The heading of a month in a calendar, such as `November 2026`. */
  monthYear: { month: "long", year: "numeric" },
  /** The head of a weekday column in a calendar, such as `Thu` or `Do`. */
  weekday: { weekday: "short" },
  /** A month in a calendar's list of a year, such as `Nov`. */
  month: { month: "short" },
  /** A year, such as `2026`. */
  year: { year: "numeric" },
  /** A day read out in full, such as `Thursday, November 5, 2026`. */
  fullDate: { dateStyle: "full" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** The name of a display format for a Calendar Day. */
export type CalendarDayFormat = keyof typeof CALENDAR_DAY_FORMATS;

// Building a formatter costs far more than using one, and a list formats many values alike.
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormatter(
  format: InstantFormat | CalendarDayFormat,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${format} ${locale} ${timeZone}`;
  let formatter = dateTimeFormatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    dateTimeFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * An Instant as text in a named format, in a language (a BCP 47 tag such as `de`) and a zone.
 * Whether the clock shows 12 or 24 hours follows the language.
 */
export function formatInstant(
  instant: Instant,
  format: InstantFormat,
  locale: string,
  timeZone: TimeZone,
): string {
  return dateTimeFormatter(format, locale, timeZone, INSTANT_FORMATS[format]).format(
    epochMsOf(instant),
  );
}

/** A Calendar Day as text in a named format and a language (a BCP 47 tag such as `de`). */
export function formatCalendarDay(
  day: CalendarDay,
  format: CalendarDayFormat,
  locale: string,
): string {
  // Parsing the ISO date and formatting it both use UTC, preserving the Calendar Day in any zone.
  return dateTimeFormatter(format, locale, "UTC", CALENDAR_DAY_FORMATS[format]).format(
    Date.parse(day),
  );
}

/** The name of a display format for a Duration. */
export type DurationFormat =
  /** Hours and minutes, rounded up to the whole minute, such as `0:05`. */
  | "hoursMinutes"
  /** Running timer with whole seconds, such as `0:04:20`. */
  | "hoursMinutesSeconds";

const durationFormatters = new Map<
  string,
  { hours: Intl.NumberFormat; minutesAndSeconds: Intl.NumberFormat }
>();

/** A Duration as text in a named format and a language (a BCP 47 tag such as `de`). */
export function formatDuration(duration: Duration, format: DurationFormat, locale: string): string {
  let formatters = durationFormatters.get(locale);
  if (formatters === undefined) {
    formatters = {
      hours: new Intl.NumberFormat(locale, { useGrouping: false, signDisplay: "never" }),
      minutesAndSeconds: new Intl.NumberFormat(locale, {
        minimumIntegerDigits: 2,
        signDisplay: "never",
      }),
    };
    durationFormatters.set(locale, formatters);
  }

  // Format the fields individually so rounding up still works at Duration's upper limit.
  const showSeconds = format === "hoursMinutesSeconds";
  const minutes = showSeconds ? Math.floor(duration / 60) : Math.ceil(duration / 60);
  const hoursText = formatters.hours.format(Math.floor(minutes / 60));
  const minutesText = formatters.minutesAndSeconds.format(minutes % 60);
  return showSeconds
    ? `${hoursText}:${minutesText}:${formatters.minutesAndSeconds.format(duration % 60)}`
    : `${hoursText}:${minutesText}`;
}
