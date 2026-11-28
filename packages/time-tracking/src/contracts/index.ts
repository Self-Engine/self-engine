import { oc } from "@orpc/contract";
import { entryFields, inputErrors, refusal } from "@self-engine/db/schema";
import { projectIdSchema } from "@self-engine/projects/ids";
import { type Instant, instantSchema, wholeSecondOf } from "@self-engine/time";
import { z } from "zod";
import { daysAnswerSchema, daysInputSchema } from "./days.ts";
import { timeEntrySchema, timeEntryWithProjectSchema } from "./entries.ts";
import { timeEntryIdSchema, timerIdSchema } from "./ids.ts";
import { noteSchema } from "./note.ts";
import { roundingRuleSchema } from "./rounding-rule.ts";
import {
  END_IN_FUTURE,
  START_IN_FUTURE,
  timerFields,
  timerSchema,
  timerStartInput,
  timerStartSchema,
  timerStopInput,
  timerStopSchema,
  timerUndoSchema,
  timerWithProjectSchema,
} from "./timers.ts";

export {
  roundingRuleIdSchema,
  type TimeEntryId,
  timeEntryIdOfTimer,
  timeEntryIdSchema,
  type TimerId,
  timerIdSchema,
} from "./ids.ts";
export { NOTE_MAX } from "./note.ts";
export {
  computeTimeEntry,
  type TimeEntryComputation,
  type TimeEntryComputationInput,
} from "./computation.ts";
export {
  BLOCK_ROUNDING_MINUTES,
  DEFAULT_ROUNDING_RULE,
  ORDINARY_ROUNDING_MINUTES,
  ROUNDING_DIRECTIONS,
  type RoundingRule,
  roundingRuleSchema,
  roundingRuleTextSchema,
} from "./rounding-rule.ts";

/**
 * A Time Entry's fields, once: the inputs of create and edit are derived from them (D329, ADR
 * 0032). Start and end, the Measured Time, are required on create; project and note are optional.
 * `ruleByHand` is a Rounding Rule chosen by hand: on create it is optional, and without one the
 * rule that holds rounds the entry; on an edit a missing one keeps the entry's own rule, a rule
 * marks it chosen by hand, and `null` clears the choice: the rule that holds is looked up again
 * and the mark removed. The answer carries the rule as `roundingRule` beside the mark. The
 * Operation computes the Rounded Time and the Booked Duration on every write (ADR 0044): no input
 * names either.
 */
export const timeEntryFields = entryFields(timeEntryIdSchema, {
  startedAt: instantSchema,
  endedAt: instantSchema,
  projectId: projectIdSchema.nullable(),
  note: noteSchema,
  ruleByHand: roundingRuleSchema.nullable(),
});

/**
 * The Reason of an edit of an entry whose stored rule this version cannot read, reported at the
 * rule chosen by hand like an input error: every edit rounds again with the entry's own rule, so the entry is
 * kept as it is until the app is current.
 */
export const ROUNDING_RULE_UNKNOWN = "rounding_rule_unknown";

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
  instantRangeSchema,
  type ListedTimeEntry,
  listedTimeEntrySchema,
  TIME_ZONE_UNKNOWN,
  type TimeEntry,
  type TimeEntryFinding,
  timeEntryFindingSchema,
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

export {
  END_IN_FUTURE,
  START_IN_FUTURE,
  type Timer,
  type TimerStart,
  type TimerStop,
  type TimerUndo,
  type TimerWithProject,
  timerFields,
  timerSchema,
  timerStartInput,
  timerStartSchema,
  timerStopInput,
  timerStopSchema,
  timerUndoSchema,
  timerWithProjectSchema,
} from "./timers.ts";

const byId = z.strictObject({ id: timeEntryIdSchema });
const byTimerId = z.strictObject({ id: timerIdSchema });

/** The module's Port (D252): mounted as `timeTracking` in the app contract. */
export const timeTrackingContract = {
  /**
   * Stores the entry's Measured Time on whole seconds, its Rounded Time and Booked Duration as
   * `computeTimeEntry` makes them, its Rounding Rule and the Time Zone of the call (D342, D344,
   * ADR 0044). Without a rule chosen by hand the default "round up to 1 minute" holds. It does not
   * check the project: the frame's reference check refuses a deleted or unknown one and accepts an
   * archived one (D337).
   */
  create: oc
    .input(timeEntryCreateInput)
    .output(timeEntrySchema)
    .errors({ ...refusal }),
  /**
   * A missing field stays untouched, `null` clears it, and an edit without fields reads. Every
   * other edit rounds again with the entry's own rule, in its own Time Zone. An entry whose stored
   * rule this version cannot read is not edited: `ROUNDING_RULE_UNKNOWN` at the rule.
   */
  edit: oc
    .input(timeEntryEditSchema)
    .output(timeEntrySchema)
    .errors({ NOT_FOUND: {}, ...inputErrors(ROUNDING_RULE_UNKNOWN), ...refusal }),
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
  /**
   * Starts a Timer at the Data Process's "now", cut to the second (D344, D348). It first stops
   * every running timer by the rules of `stopTimer`, in the same transaction, and answers what
   * each stop did beside the new timer (D349): one timer runs at a time as a flow, not as a rule
   * (D310). It does not check the project: the frame's reference check refuses a deleted or
   * unknown one and accepts an archived one (D337).
   */
  startTimer: oc
    .input(timerStartInput)
    .output(timerStartSchema)
    .errors({ ...refusal }),
  /**
   * The edit pattern (D329): a missing field stays untouched, `null` clears the project or the
   * note, and an edit without fields reads. A start after the Data Process's "now" is an input
   * error at the start, with the Reason `START_IN_FUTURE`.
   */
  editTimer: oc
    .input(timerFields.edit)
    .output(timerSchema)
    .errors({ NOT_FOUND: {}, ...inputErrors(START_IN_FUTURE), ...refusal }),
  /**
   * Stops a Timer into its Time Entry in one transaction (D349): the entry takes the timer's id,
   * start, project and note, the end (the Data Process's "now" or the one given) cut to the second
   * and the Time Zone of the Setting; the timer is soft-deleted. See `timerStopSchema` for the
   * three answers. A stopped timer answers its entry again and writes nothing; a discarded or
   * unknown one is not found. An end not after the start, or after "now", is an input error at
   * the end (`END_BEFORE_START`, `END_IN_FUTURE`). The project is not checked (D337).
   */
  stopTimer: oc
    .input(timerStopInput)
    .output(timerStopSchema)
    .errors({ NOT_FOUND: {}, ...inputErrors(END_BEFORE_START, END_IN_FUTURE), ...refusal }),
  /** Removes a running Timer without a Time Entry: a soft delete. */
  discardTimer: oc
    .input(byTimerId)
    .output(timerSchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /**
   * The undo of a stop, one Operation in one transaction with one Table Change (D349): it first
   * stops every other running timer by the rules of `stopTimer`, then soft-deletes the timer's
   * entry as it is and restores the timer with its own start, project and note. A refused restore
   * (the timer's project was deleted meanwhile) refuses the whole undo and writes nothing. A timer
   * that runs again answers `alreadyRunning` and writes nothing; one without a live entry of its
   * id (discarded, unknown, or its entry deleted by hand) is not found. See `timerUndoSchema`.
   */
  undoStopTimer: oc
    .input(byTimerId)
    .output(timerUndoSchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /**
   * The undo of a discard, one Operation in one transaction (D349): it first stops every other
   * running timer by the rules of `stopTimer`, then restores the timer. A refused restore refuses
   * the whole undo and writes nothing. A timer that runs again answers `alreadyRunning` and writes
   * nothing; a stopped timer (one with a live entry of its id) and an unknown one are not found.
   */
  undoDiscardTimer: oc
    .input(byTimerId)
    .output(timerUndoSchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /**
   * The running Timers with their Project References, the most recently started first. One runs
   * at a time through the app's own Operations; after a sync there may be several (D310).
   */
  runningTimers: oc.output(z.array(timerWithProjectSchema)),
};
