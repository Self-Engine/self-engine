import { entryFields } from "@self-engine/db/schema";
import { projectIdSchema, projectReferenceSchema } from "@self-engine/projects/contracts";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { timeEntrySchema } from "./entries.ts";
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

/**
 * The Reason of an end at "Stop at …" after the Data Process's "now", reported at the end like an
 * input error: the limit is a moment only the Data Process knows (D348).
 */
export const END_IN_FUTURE = "end_in_future";

/**
 * The input of stop: the timer and, for "Stop at …", an end. Without one the Data Process's "now"
 * ends it. An end lies at least one second after the start and not after "now" (D344, D349).
 */
export const timerStopInput = z.strictObject({
  id: timerIdSchema,
  endedAt: instantSchema.optional(),
});

/**
 * What a stop did, one of three (D349): the entry was saved (also when an earlier stop saved it:
 * stopping twice writes once); the timer was discarded, since it ended within the second it
 * started (D344); or the Data Process's "now" lies before the start, so nothing was written and
 * the timer runs on. A caller tells them apart by `kind`.
 */
export const timerStopSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), entry: timeEntrySchema }),
  z.object({ kind: z.literal("discarded"), timer: timerSchema }),
  z.object({ kind: z.literal("clockBeforeStart"), timer: timerSchema }),
]);
export type TimerStop = z.output<typeof timerStopSchema>;

/**
 * The answer of start: the new timer, and what stopping each timer that ran before did (D349),
 * the most recently started first. Empty when none ran.
 */
export const timerStartSchema = z.object({
  timer: timerSchema,
  others: z.array(timerStopSchema),
});
export type TimerStart = z.output<typeof timerStartSchema>;
