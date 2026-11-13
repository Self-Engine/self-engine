import { calendarDayFrom } from "./supported-years.ts";
import { daySpanSchema, type DaySpan, type CalendarDay } from "./values.ts";

function requireWhole(amount: number): void {
  if (!Number.isInteger(amount))
    throw new RangeError("Calendar arithmetic requires a whole number");
}

/** Move by whole calendar days, with no time zone involved. */
export function addDays(day: CalendarDay, amount: number): CalendarDay {
  requireWhole(amount);
  return calendarDayFrom(Temporal.PlainDate.from(day).add({ days: amount }));
}

/** Move by whole months, constraining the day to the target month's last day. */
export function addMonths(day: CalendarDay, amount: number): CalendarDay {
  requireWhole(amount);
  return calendarDayFrom(
    Temporal.PlainDate.from(day).add({ months: amount }, { overflow: "constrain" }),
  );
}

/** Whole calendar days from `from` to `to`, negative when `to` comes first. */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  return Temporal.PlainDate.from(from).until(to, { largestUnit: "days" }).days;
}

/** Sunday = 0, Monday = 1, through Saturday = 6, as in the original time package. */
export type FirstDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The seven-day span holding `day`; both boundaries must be within years 1000–9999. */
export function weekOf(day: CalendarDay, firstDayOfWeek: FirstDayOfWeek): DaySpan {
  const weekday = Temporal.PlainDate.from(day).dayOfWeek % 7;
  const first = addDays(day, -((weekday - firstDayOfWeek + 7) % 7));
  return daySpanSchema.parse({ first, last: addDays(first, 6) });
}

/** ISO 8601 week number: Monday weeks, week 1 contains the year's first Thursday. */
export function isoWeekNumber(day: CalendarDay): number {
  return Temporal.PlainDate.from(day).weekOfYear!;
}
