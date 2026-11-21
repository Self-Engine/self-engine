import { oc } from "@orpc/contract";
import { entryFields, refusal } from "@self-engine/db/schema";
import { projectIdSchema } from "@self-engine/projects/ids";
import { type Instant, instantSchema, wholeSecondOf } from "@self-engine/time";
import { z } from "zod";
import { daysAnswerSchema, daysInputSchema } from "./days.ts";
import { timeEntrySchema, timeEntryWithProjectSchema } from "./entries.ts";
import { timeEntryIdSchema } from "./ids.ts";

export { type TimeEntryId, timeEntryIdSchema } from "./ids.ts";

/** The longest note, in characters after trimming. */
export const NOTE_MAX = 10_000;

/**
 * A Time Entry's fields, once: the inputs of create and edit are derived from them (D329, ADR
 * 0032). Start and end are required on create; project and note are optional. The Operation
 * computes the Booked Duration when it writes the range (D346). The input rejects a duration
 * field.
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
/** The input of create, which the input Command checks with too: the same checks for every caller. */
export const timeEntryCreateInput = timeEntryFields.create.refine(
  endsAfterStart,
  endsAfterStartIssue,
);

const timeEntryEditSchema = timeEntryFields.edit
  .refine(endsAfterStart, endsAfterStartIssue)
  .refine(timesTravelTogether, { params: { reason: "start_and_end_together" } });

export {
  type TimeEntry,
  type TimeEntryWithProject,
  timeEntrySchema,
  timeEntryWithProjectSchema,
} from "./entries.ts";
export {
  type DayEntry,
  type DaysAnswer,
  type DaysInput,
  type ProjectTotal,
  SPAN_MAX_DAYS,
  SPAN_TOO_LONG,
  type SpanDay,
  type TimeEntryFilter,
  dayEntrySchema,
  daysAnswerSchema,
  daysInputSchema,
  projectTotalSchema,
  spanDaySchema,
  timeEntryFilterSchema,
} from "./days.ts";

const byId = z.strictObject({ id: timeEntryIdSchema });

/** The module's Port (D252): mounted as `timeTracking` in the app contract. */
export const timeTrackingContract = {
  /**
   * Stores the entry on whole seconds, with its Booked Duration and the Time Zone of the call (D342,
   * D344, D346). It does not check the project: the frame's reference check refuses a deleted or
   * unknown one and accepts an archived one (D337).
   */
  create: oc
    .input(timeEntryCreateInput)
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
  /**
   * The entries and sums of a Day Span, in the Time Zone of the call (D343, D354); see
   * `daysAnswerSchema`. A span over `SPAN_MAX_DAYS` days is an input error.
   */
  days: oc.input(daysInputSchema).output(daysAnswerSchema),
};
