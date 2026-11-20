import { z } from "zod/mini";

/** The seven named week starts. The Setting can separately allow automatic selection. */
export const firstDayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export type FirstDayOfWeek = z.output<typeof firstDayOfWeekSchema>;
