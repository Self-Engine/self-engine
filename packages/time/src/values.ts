import { z } from "zod";

/** A calendar date without a zone, stored as YYYY-MM-DD (years 1000–9999). */
export const calendarDaySchema = z.iso.date().regex(/^[1-9]\d{3}-/, "Year must be between 1000 and 9999").brand<"CalendarDay">();
export type CalendarDay = z.output<typeof calendarDaySchema>;

/** A minute-precision time without a day or zone, stored as HH:MM. */
export const wallClockTimeSchema = z.iso.time({ precision: -1 }).brand<"WallClockTime">();
export type WallClockTime = z.output<typeof wallClockTimeSchema>;

/** First and last calendar day, both included; stored in two day columns. */
export const daySpanSchema = z.object({ first: calendarDaySchema, last: calendarDaySchema })
  .refine(({ first, last }) => last >= first, "Day span ends before it starts")
  .brand<"DaySpan">();
export type DaySpan = z.output<typeof daySpanSchema>;

/** Non-negative whole seconds, stored in a column ending in _seconds. */
export const durationSchema = z.number().int().nonnegative().brand<"Duration">();
export type Duration = z.output<typeof durationSchema>;
