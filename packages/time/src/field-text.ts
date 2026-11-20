// What a date or time field of a form reads (D319): a typed day, the names a calendar picker
// shows, and whether a time picker counts 12 or 24 hours. The texts are named formats of
// `format.ts`; everything follows the language and nothing reads a Setting or a clock. The picker
// itself exchanges the stored forms, `YYYY-MM-DD` and `HH:MM`, which are the values of `time`;
// its own month and weekday names would come from a date library, so `forms` hands it these.

import { formatCalendarDay } from "./format.ts";
import { calendarDayFrom } from "./supported-years.ts";
import { calendarDaySchema, type CalendarDay } from "./values.ts";

type DatePart = "day" | "month" | "year";

/** A day whose day, month and year differ in every digit, to find each in a date's text. */
const PROBE = { day: "22", month: "11", year: "2033" } as const;
const PROBE_DAY = calendarDaySchema.parse(`${PROBE.year}-${PROBE.month}-${PROBE.day}`);

const orders = new Map<string, readonly DatePart[]>();

/** The order of day, month and year in the date a field shows (`fieldDate`). */
function orderOf(locale: string): readonly DatePart[] {
  let order = orders.get(locale);
  if (order === undefined) {
    const text = formatCalendarDay(PROBE_DAY, "fieldDate", locale);
    order = (["day", "month", "year"] as const)
      .map((part) => ({ part, at: text.indexOf(PROBE[part]) }))
      .sort((a, b) => a.at - b.at)
      .map(({ part }) => part);
    orders.set(locale, order);
  }
  return order;
}

/** The day a year, month and day name, or `null` when it does not exist or lies outside 1000–9999. */
function existingDay(year: number, month: number, day: number): CalendarDay | null {
  if (year < 1000 || year > 9999 || month < 1 || day < 1) return null;
  const date = Temporal.PlainDate.from({ year, month, day }, { overflow: "constrain" });
  // A month or day too large is moved to the last one there is: then it named no day.
  return date.month === month && date.day === day ? calendarDayFrom(date) : null;
}

/**
 * The Calendar Day a person typed, in the order of day, month and year that the language's
 * `fieldDate` shows, with any separators, or as `YYYY-MM-DD`; `null` while the text is no whole,
 * existing day. A two-digit year lies in 2000–2099.
 */
export function calendarDayFromText(text: string, locale: string): CalendarDay | null {
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso !== null) return existingDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const groups = /^\d{1,4}\D+\d{1,4}\D+\d{1,4}$/.test(trimmed) ? trimmed.split(/\D+/) : [];
  if (groups.length !== 3) return null;
  const order = orderOf(locale);
  const [day, month, year] = (["day", "month", "year"] as const).map(
    (part) => groups[order.indexOf(part)],
  );
  if (day === undefined || month === undefined || year === undefined) return null;
  if (day.length > 2 || month.length > 2 || (year.length !== 2 && year.length !== 4)) return null;
  return existingDay(
    year.length === 2 ? 2000 + Number(year) : Number(year),
    Number(month),
    Number(day),
  );
}

/** The names a calendar picker shows for a Calendar Day, in one language. */
export interface CalendarLabels {
  /** The heading of a month: `November 2026`. */
  readonly month: (day: CalendarDay) => string;
  /** The head of a weekday column: `Do`, `Thu`. */
  readonly weekday: (day: CalendarDay) => string;
  /** A month in the list of a year: `Nov`. */
  readonly monthShort: (day: CalendarDay) => string;
  /** A year: `2026`. */
  readonly year: (day: CalendarDay) => string;
  /** A day read out in full, for a screen reader: `Thursday, November 5, 2026`. */
  readonly day: (day: CalendarDay) => string;
}

const labels = new Map<string, CalendarLabels>();

/** The names a calendar picker shows, in `locale`; the same object for the same language. */
export function calendarLabels(locale: string): CalendarLabels {
  let found = labels.get(locale);
  if (found === undefined) {
    found = {
      month: (day) => formatCalendarDay(day, "monthYear", locale),
      weekday: (day) => formatCalendarDay(day, "weekday", locale),
      monthShort: (day) => formatCalendarDay(day, "month", locale),
      year: (day) => formatCalendarDay(day, "year", locale),
      day: (day) => formatCalendarDay(day, "fullDate", locale),
    };
    labels.set(locale, found);
  }
  return found;
}

const clocks = new Map<string, "12h" | "24h">();

/** Whether a time picker in `locale` counts 12 hours with AM and PM, or 24, as `formatInstant`. */
export function clockFormatOf(locale: string): "12h" | "24h" {
  let clock = clocks.get(locale);
  if (clock === undefined) {
    const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions();
    clock = hourCycle === "h11" || hourCycle === "h12" ? "12h" : "24h";
    clocks.set(locale, clock);
  }
  return clock;
}
