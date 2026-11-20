// The offset of a zone from UTC as a person reads it: `UTC+1`, `UTC-3:30`, `UTC+0`. The Time Zone
// picker of the settings and the note at a repeated wall-clock time in a form show the same text.

import type { Instant } from "./instant.ts";
import type { TimeZone } from "./zone.ts";
import { zonedOf } from "./zoned-day.ts";

/** An offset of whole minutes, rounded from any seconds, as `UTC+1` or `UTC-3:30`. */
export function utcOffsetText(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? "-" : "+";
  const hours = Math.floor(Math.abs(rounded) / 60);
  const rest = Math.abs(rounded) % 60;
  return `UTC${sign}${hours}${rest === 0 ? "" : `:${String(rest).padStart(2, "0")}`}`;
}

/**
 * A signed ISO offset, such as `+01:00`, `-03:30` or `+00:19:32` (the `offset` of a repeated
 * `WallClockTimeResolution`), as the Time Zone picker shows it: `UTC+1`, `UTC-3:30`, `UTC+0:20`.
 */
export function formatUtcOffset(offset: string): string {
  const parts = /^([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(offset);
  if (parts === null) throw new RangeError(`Not a UTC offset: ${JSON.stringify(offset)}`);
  const [, sign, hours, minutes, seconds] = parts;
  const total = Number(hours) * 60 + Number(minutes) + Number(seconds ?? 0) / 60;
  return utcOffsetText(sign === "-" ? -total : total);
}

/**
 * The ISO offset of `instant` in `timeZone` when the zone shows its wall-clock minute twice that
 * day, because the clocks went back over it; `null` when the zone shows it once. A form names the
 * offset beside such a time, so the person sees which of the two is meant.
 */
export function repeatedOffsetOf(instant: Instant, timeZone: TimeZone): string | null {
  const zoned = zonedOf(instant, timeZone).round({ smallestUnit: "minute", roundingMode: "trunc" });
  const local = zoned.toPlainDateTime();
  const earlier = local.toZonedDateTime(timeZone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(timeZone, { disambiguation: "later" });
  const repeated =
    earlier.epochNanoseconds !== later.epochNanoseconds && earlier.toPlainDateTime().equals(local);
  return repeated ? zoned.offset : null;
}
