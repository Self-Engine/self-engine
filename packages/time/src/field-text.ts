// What a date or time field of a form shows and reads (D319): the text of a Calendar Day, a typed
// day read back, the names a calendar picker shows, and whether a time picker counts 12 or 24
// hours. Everything follows the language and nothing reads a Setting or a clock. The picker
// itself exchanges the stored forms, `YYYY-MM-DD` and `HH:MM`, which are the values of `time`;
// its own month and weekday names would come from a date library, so `forms` hands it these.

import { calendarDayFrom } from "./supported-years.ts";
import type { CalendarDay } from "./values.ts";

/** Building a formatter costs far more than using one, and a calendar names 42 days at once. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterOf(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale} ${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    // The day is read at UTC midnight, so the device's zone never moves it.
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    formatters.set(key, formatter);
  }
  return formatter;
}

function epochMsOfDay(day: CalendarDay): number {
  return Temporal.PlainDate.from(day).toZonedDateTime("UTC").epochMilliseconds;
}

const DIGITS = { day: "2-digit", month: "2-digit", year: "numeric" } as const;

/** A Calendar Day as a date field shows it and reads it back: `05.11.2026`, `11/05/2026`. */
export function calendarDayText(day: CalendarDay, locale: string): string {
  return formatterOf(locale, DIGITS).format(epochMsOfDay(day));
}

type DatePart = "day" | "month" | "year";

const orders = new Map<string, readonly DatePart[]>();

/** The order of day, month and year in the language's numeric date. */
function orderOf(locale: string): readonly DatePart[] {
  let order = orders.get(locale);
  if (order === undefined) {
    order = formatterOf(locale, DIGITS)
      .formatToParts(0)
      .flatMap(({ type }) => (type === "day" || type === "month" || type === "year" ? [type] : []));
    orders.set(locale, order);
  }
  return order;
}

/** The day `[year, month, day]` names, or `null` when it does not exist or lies outside 1000–9999. */
function dayOf(year: number, month: number, day: number): CalendarDay | null {
  if (year < 1000 || year > 9999 || month < 1 || day < 1) return null;
  const date = Temporal.PlainDate.from({ year, month, day }, { overflow: "constrain" });
  // A month or day too large is moved to the last one there is: then it named no day.
  return date.month === month && date.day === day ? calendarDayFrom(date) : null;
}

/**
 * The Calendar Day a person typed, in the language's order of day, month and year with any
 * separators, or as `YYYY-MM-DD`; `null` while the text is no whole, existing day. A two-digit
 * year lies in 2000–2099.
 */
export function calendarDayFromText(text: string, locale: string): CalendarDay | null {
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso !== null) return dayOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const groups = /^\d{1,4}\D+\d{1,4}\D+\d{1,4}$/.test(trimmed) ? trimmed.split(/\D+/) : [];
  if (groups.length !== 3) return null;
  const order = orderOf(locale);
  const [day, month, year] = (["day", "month", "year"] as const).map(
    (part) => groups[order.indexOf(part)],
  );
  if (day === undefined || month === undefined || year === undefined) return null;
  if (day.length > 2 || month.length > 2 || (year.length !== 2 && year.length !== 4)) return null;
  return dayOf(year.length === 2 ? 2000 + Number(year) : Number(year), Number(month), Number(day));
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

function labelOf(locale: string, options: Intl.DateTimeFormatOptions) {
  return (day: CalendarDay) => formatterOf(locale, options).format(epochMsOfDay(day));
}

/** The names a calendar picker shows, in `locale`; the same object for the same language. */
export function calendarLabels(locale: string): CalendarLabels {
  let found = labels.get(locale);
  if (found === undefined) {
    found = {
      month: labelOf(locale, { month: "long", year: "numeric" }),
      weekday: labelOf(locale, { weekday: "short" }),
      monthShort: labelOf(locale, { month: "short" }),
      year: labelOf(locale, { year: "numeric" }),
      day: labelOf(locale, { dateStyle: "full" }),
    };
    labels.set(locale, found);
  }
  return found;
}

/** Whether a time picker in `locale` counts 12 hours with AM and PM, or 24. */
export function clockFormatOf(locale: string): "12h" | "24h" {
  const { hourCycle } = formatterOf(locale, { hour: "numeric" }).resolvedOptions();
  return hourCycle === "h11" || hourCycle === "h12" ? "12h" : "24h";
}
