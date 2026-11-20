// Internal: the one way from a Temporal result to a value of `time`. A result outside the
// supported years 1000–9999 throws a RangeError. It builds the value without the schemas of
// `time`, so code the page loads at its start, such as the page clock, can use it without Zod's
// full build (docs/development/performance.md). Temporal writes exactly the stored forms for
// every moment and day of those years; `supported-years.test.ts` pins that against the schemas.
import type { Instant } from "./instant.ts";
import type { CalendarDay } from "./values.ts";

const FIRST_YEAR = 1000;
const LAST_YEAR = 9999;

function outOfRange(): never {
  throw new RangeError("Outside the supported years 1000–9999");
}

/** The Instant of an exact moment, to the millisecond. */
export function instantFrom(exact: Temporal.Instant): Instant {
  const { year } = exact.toZonedDateTimeISO("UTC");
  if (year < FIRST_YEAR || year > LAST_YEAR) outOfRange();
  return exact.toString({ fractionalSecondDigits: 3 }) as Instant;
}

/** The calendar day of a plain date. */
export function calendarDayFrom(date: Temporal.PlainDate): CalendarDay {
  if (date.year < FIRST_YEAR || date.year > LAST_YEAR) outOfRange();
  return date.toString() as CalendarDay;
}
