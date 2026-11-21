import { projectIdSchema, projectReferenceSchema } from "@self-engine/projects/contracts";
import { durationSchema, instantSchema } from "@self-engine/time";
import { z } from "zod";
import { timeEntryIdSchema } from "./ids.ts";

/**
 * A time entry as the Port answers it. `durationSeconds` is the Booked Duration: the time that
 * counts, in layer 4 always end minus start (D308). The Time Zone the row stores is not answered:
 * layer 4 never reads it (D342).
 */
export const timeEntrySchema = z.object({
  id: timeEntryIdSchema,
  startedAt: instantSchema,
  endedAt: instantSchema,
  durationSeconds: durationSchema,
  projectId: projectIdSchema.nullable(),
  note: z.string().nullable(),
});
export type TimeEntry = z.output<typeof timeEntrySchema>;

/**
 * A time entry with its project as a Project Reference (D330), as the Edit Drawer shows it: `null`
 * without a project. An archived or deleted project keeps its marks.
 */
export const timeEntryWithProjectSchema = timeEntrySchema.extend({
  project: projectReferenceSchema.nullable(),
});
export type TimeEntryWithProject = z.output<typeof timeEntryWithProjectSchema>;
