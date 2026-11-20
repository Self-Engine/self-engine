// The calendar day of an Instant in a zone and the first moment of a day, apart from `zoned.ts`:
// they build their values without the schemas of `time`, so the page clock can load them at the
// page's start without Zod's full build (docs/development/performance.md).
import type { Instant } from "./instant.ts";
import { calendarDayFrom, instantFrom } from "./supported-years.ts";
import type { CalendarDay } from "./values.ts";
import type { TimeZone } from "./zone.ts";

export function zonedOf(instant: Instant, timeZone: TimeZone): Temporal.ZonedDateTime {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
}

/** The calendar day an Instant falls on in a zone. */
export function calendarDayOf(instant: Instant, timeZone: TimeZone): CalendarDay {
  return calendarDayFrom(zonedOf(instant, timeZone).toPlainDate());
}

/** The first moment of a day in a zone; not always 00:00. */
export function startOfCalendarDay(day: CalendarDay, timeZone: TimeZone): Instant {
  return instantFrom(Temporal.PlainDate.from(day).toZonedDateTime(timeZone).toInstant());
}
