import { idSchema } from "@self-engine/db/schema";
import type { z } from "zod";

export const timeEntryIdSchema = idSchema("TimeEntry");
/** A time entry's id, branded so no other entry's id takes its place. */
export type TimeEntryId = z.output<typeof timeEntryIdSchema>;
