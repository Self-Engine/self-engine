import { z } from "zod";

/** An exact moment in UTC, stored as `YYYY-MM-DDTHH:MM:SS.sssZ` (years 1000–9999). */
export const instantSchema = z.iso
  .datetime({ precision: 3 })
  .regex(/^[1-9]\d{3}-/, "Year must be between 1000 and 9999")
  .brand<"Instant">();

export type Instant = z.output<typeof instantSchema>;
