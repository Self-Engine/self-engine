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

const FIRST_DAY_BY_REGION = {
  "de-DE": "monday",
  "en-US": "sunday",
} as const satisfies Record<string, FirstDayOfWeek>;

/** A region whose first day of the week `time` knows. */
export type Region = keyof typeof FIRST_DAY_BY_REGION;

/** The first day of the week for a supported region. */
export function firstDayOfWeekForRegion(region: Region): FirstDayOfWeek {
  return FIRST_DAY_BY_REGION[region];
}
