// Internal: the one way from a Temporal result to a value of `time`. A result outside the
// supported years 1000–9999 fails its schema and throws a RangeError, never Zod's error.
import { instantSchema, type Instant } from "./instant.ts";
import { calendarDaySchema, type CalendarDay } from "./values.ts";

function outOfRange(): never {
  throw new RangeError("Outside the supported years 1000–9999");
}

/** The Instant of an exact moment, to the millisecond. */
export function instantFrom(exact: Temporal.Instant): Instant {
  const parsed = instantSchema.safeParse(exact.toString({ fractionalSecondDigits: 3 }));
  return parsed.success ? parsed.data : outOfRange();
}

/** The calendar day of a plain date. */
export function calendarDayFrom(date: Temporal.PlainDate): CalendarDay {
  const parsed = calendarDaySchema.safeParse(date.toString());
  return parsed.success ? parsed.data : outOfRange();
}
