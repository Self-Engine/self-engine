import { idSchema } from "@self-engine/db/schema";
import type { z } from "zod";

export const timeEntryIdSchema = idSchema("TimeEntry");
/** A Time Entry's id, branded so no other entry's id takes its place. */
export type TimeEntryId = z.output<typeof timeEntryIdSchema>;

export const timerIdSchema = idSchema("Timer");
/**
 * A Timer's id, branded apart from a Time Entry's: the entry a stop writes takes the timer's id
 * (D349), and only the module's one conversion turns one into the other.
 */
export type TimerId = z.output<typeof timerIdSchema>;

/**
 * The module's one conversion between the two id types (D349): the Time Entry a stop writes takes
 * its Timer's id, so two stops of one timer, also on two devices, write the same row. No other
 * code turns one id type into the other.
 */
export function timeEntryIdOfTimer(id: TimerId): TimeEntryId {
  // Both brands sit on the same UUIDv7 text; only the brand changes.
  return id as string as TimeEntryId;
}
