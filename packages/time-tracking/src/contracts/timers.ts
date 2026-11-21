import { entryFields } from "@self-engine/db/schema";
import { projectIdSchema, projectReferenceSchema } from "@self-engine/projects/contracts";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { timerIdSchema } from "./ids.ts";
import { noteSchema } from "./note.ts";

/**
 * A running Timer as the Port answers it (D310): its start on a whole second, an optional project
 * and an optional note. The running time is "now" minus the start; nothing of it is stored.
 */
export const timerSchema = z.object({
  id: timerIdSchema,
  startedAt: instantSchema,
  projectId: projectIdSchema.nullable(),
  note: z.string().nullable(),
});
export type Timer = z.output<typeof timerSchema>;

/** A Timer with its project as a Project Reference (D330): `null` without a project. */
export const timerWithProjectSchema = timerSchema.extend({
  project: projectReferenceSchema.nullable(),
});
export type TimerWithProject = z.output<typeof timerWithProjectSchema>;

/**
 * A Timer's fields, once: the inputs of start and edit are derived from them (D329, ADR 0032).
 * Start takes no start: the Data Process's Clock sets it (D348).
 */
export const timerFields = entryFields(timerIdSchema, {
  startedAt: instantSchema,
  projectId: projectIdSchema.nullable(),
  note: noteSchema,
});

/** The input of start: an optional project and note, and never a start. */
export const timerStartInput = timerFields.create.omit({ startedAt: true });

/**
 * The Reason of a start after the Data Process's "now", reported at the start like an input
 * error: the limit is a moment only the Data Process knows (D348).
 */
export const START_IN_FUTURE = "start_in_future";
