// The named display formats: a View picks one by name and passes the language and the zone, so
// two Views show a date the same way. There are no free options; a new need is a new name here.
// The set grows with its users: today the list of Backups.

import { epochMsOf } from "./borders.ts";
import type { Instant } from "./instant.ts";
import type { TimeZone } from "./zone.ts";

const INSTANT_FORMATS = {
  /** Date and time of day, such as `Nov 13, 2026, 1:30 PM` or `13.11.2026, 13:30`. */
  dateTime: { dateStyle: "medium", timeStyle: "short" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** The name of a display format for an Instant. */
export type InstantFormat = keyof typeof INSTANT_FORMATS;

// Building a formatter costs far more than using one, and a list formats many Instants alike.
const formatters = new Map<string, Intl.DateTimeFormat>();

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
  const key = `${format} ${locale} ${timeZone}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, { ...INSTANT_FORMATS[format], timeZone });
    formatters.set(key, formatter);
  }
  return formatter.format(epochMsOf(instant));
}
