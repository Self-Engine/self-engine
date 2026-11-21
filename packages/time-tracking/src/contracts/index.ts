import { oc } from "@orpc/contract";
import { entryFields, idSchema, refusal } from "@self-engine/db/schema";
import { projectIdSchema, projectReferenceSchema } from "@self-engine/projects/contracts";
import { durationSchema, type Instant, instantSchema, wholeSecondOf } from "@self-engine/time";
import { z } from "zod";

export const timeEntryIdSchema = idSchema("TimeEntry");
/** A time entry's id, branded so no other entry's id takes its place. */
export type TimeEntryId = z.output<typeof timeEntryIdSchema>;

/** The longest note, in characters after trimming. */
export const NOTE_MAX = 10_000;

/**
 * A time entry's fields, once: the inputs of create and edit are derived from them (D329, ADR
 * 0032). Start and end are required; project and note are optional. The duration is no field: the
 * Operation computes it from start and end on every write (D346), so an input that names it is an
 * input error.
 */
export const timeEntryFields = entryFields(timeEntryIdSchema, {
  startedAt: instantSchema,
  endedAt: instantSchema,
  projectId: projectIdSchema.nullable(),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX)
    .transform((text) => (text === "" ? null : text))
    .nullable(),
});

/** The Reason of the rule across start and end; the module's form gives its text (D320). */
export const END_BEFORE_START = "end_before_start";

/**
 * The rule across start and end (D344): the end lies at least one second after the start,
 * compared on the Instants cut to the second, as the Operation stores them. It holds whenever
 * both travel, so an edit that sends them together (D323) checks it too.
 */
export function endsAfterStart(times: {
  readonly startedAt?: Instant | undefined;
  readonly endedAt?: Instant | undefined;
}): boolean {
  const { startedAt, endedAt } = times;
  if (startedAt === undefined || endedAt === undefined) return true;
  // Instants of the supported years compare as text in time order.
  return wholeSecondOf(endedAt) > wholeSecondOf(startedAt);
}

/** Where the rule reports: at the end, with its Reason. */
export const endsAfterStartIssue = { path: ["endedAt"], params: { reason: END_BEFORE_START } };

/** The Edit Drawer sends both Instants when either one changes (D323). */
export const timeEntryTiedFields = [["startedAt", "endedAt"]] as const;

type EditFields = z.output<typeof timeEntryFields.edit>;
type EditTimes =
  | { startedAt: Instant; endedAt: Instant }
  | { startedAt?: undefined; endedAt?: undefined };

function timesTravelTogether(input: EditFields): input is EditFields & EditTimes {
  return (input.startedAt === undefined) === (input.endedAt === undefined);
}

// A predicate narrows what the Data Process receives. The strict Field List object still
// supplies the caller input type and lets the contract kit check the edit pattern.
const timeEntryEditSchema = timeEntryFields.edit
  .refine(endsAfterStart, endsAfterStartIssue)
  .refine(timesTravelTogether, { params: { reason: "start_and_end_together" } });

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

const byId = z.strictObject({ id: timeEntryIdSchema });

/** The module's Port (D252): mounted as `timeTracking` in the app contract. */
export const timeTrackingContract = {
  /**
   * Stores the entry on whole seconds, with its duration and the Time Zone of the call (D342,
   * D344, D346). It does not check the project: the frame's reference check refuses a deleted or
   * unknown one and accepts an archived one (D337).
   */
  create: oc
    .input(timeEntryFields.create.refine(endsAfterStart, endsAfterStartIssue))
    .output(timeEntrySchema)
    .errors({ ...refusal }),
  /** A missing field stays untouched, `null` clears it, and an edit without fields reads. */
  edit: oc
    .input(timeEntryEditSchema)
    .output(timeEntrySchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /** A soft delete, reversible through restore. */
  delete: oc
    .input(byId)
    .output(timeEntrySchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /** Brings a deleted entry back. The frame refuses it if its project was deleted (D337). */
  restore: oc
    .input(byId)
    .output(timeEntrySchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /** One Live Row with its project, for the Edit Drawer; `null` for an unknown or deleted id. */
  entry: oc.input(byId).output(timeEntryWithProjectSchema.nullable()),
};
