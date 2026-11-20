import type { FirstDayOfWeek } from "./first-day-of-week.ts";
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

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const satisfies Record<FirstDayOfWeek, 0 | 1 | 2 | 3 | 4 | 5 | 6>;

/** Mantine counts from Sunday (0) through Saturday (6). */
export function mantineFirstDayOfWeek(firstDayOfWeek: FirstDayOfWeek) {
  return WEEKDAY_INDEX[firstDayOfWeek];
}

const FIRST_DAY_BY_REGION = {
  "de-DE": "monday",
  "en-US": "sunday",
} as const satisfies Record<string, FirstDayOfWeek>;

/** The first day of the week for a supported region. */
export function firstDayOfWeekForRegion(region: keyof typeof FIRST_DAY_BY_REGION): FirstDayOfWeek {
  return FIRST_DAY_BY_REGION[region];
}

/** The seven-day span holding `day`; both boundaries must be within years 1000–9999. */
export function weekOf(day: CalendarDay, firstDayOfWeek: FirstDayOfWeek): DaySpan {
  const weekday = Temporal.PlainDate.from(day).dayOfWeek % 7;
  const first = addDays(day, -((weekday - WEEKDAY_INDEX[firstDayOfWeek] + 7) % 7));
  return daySpanSchema.parse({ first, last: addDays(first, 6) });
}

/** ISO 8601 week number: Monday weeks, week 1 contains the year's first Thursday. */
export function isoWeekNumber(day: CalendarDay): number {
  return Temporal.PlainDate.from(day).weekOfYear!;
}
