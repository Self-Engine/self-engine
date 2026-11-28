import { defineStorageModule, inputError, sharedWrites, smallSetList } from "@self-engine/storage";
import { wholeSecondOf } from "@self-engine/time";
import {
  ROUNDING_RULE_UNKNOWN,
  roundingRuleTextSchema,
  START_IN_FUTURE,
  timeEntryIdSchema,
  timerIdSchema,
  timeTrackingContract,
} from "../contracts/index.ts";
import { spanDays } from "./days.ts";
import { liveEntriesWithProject, toTimeEntryWithProject } from "./entries-with-project.ts";
import { TIME_TRACKING_READS } from "./reads.ts";
import { roundedColumns, ruleThatHolds } from "./rounded-columns.ts";
import { timeTrackingMigrations, timeTrackingRowMap, toTimeEntry, toTimer } from "./rows.ts";
import { stopRunningTimers, stopTimer } from "./stop-timer.ts";
import { runningTimers, toTimerWithProject } from "./timers.ts";
import { undoDiscardTimer, undoStopTimer } from "./undo-timer.ts";

/**
 * The Storage of `time-tracking` (D252). It registers no Protection Rule: "end after start" is a
 * check of the input, and overlapping entries are valid data (D311). It refers to `projects`
 * through a column and reads it through its Read Piece; `projects` knows nothing of it (D308).
 */
export const timeTracking = defineStorageModule({
  name: "timeTracking",
  contract: timeTrackingContract,
  migrations: timeTrackingMigrations,
  rowMap: timeTrackingRowMap,
}).entries({
  create: {
    kind: "operation",
    // The frame's reference check refuses a deleted or unknown project; an archived one is a
    // valid target (D330, D337).
    async run(tx, context, input) {
      // The zone the call computes with, read in its transaction (D342, D353).
      const timeZone = await context.readTimeZone(tx);
      const byHand = input.ruleByHand ?? undefined;
      return toTimeEntry(
        await sharedWrites(tx, context).insert("time_entries", context.newId(timeEntryIdSchema), {
          ...roundedColumns({
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            timeZone,
            rule: byHand ?? ruleThatHolds(),
            ruleChosenByHand: byHand !== undefined,
          }),
          project_id: input.projectId ?? null,
          note: input.note ?? null,
          time_zone: timeZone,
        }),
      );
    },
  },
  edit: {
    kind: "operation",
    edit: true,
    // Every edit rounds again with the entry's own rule in its own Time Zone (ADR 0044): one
    // lookup of the row before the write.
    async run(tx, context, input) {
      const { id, startedAt, endedAt, ruleByHand, projectId, note } = input;
      const writes = sharedWrites(tx, context);
      const fields = [startedAt, ruleByHand, projectId, note];
      if (fields.every((field) => field === undefined)) {
        return toTimeEntry(await writes.update("time_entries", id, {}));
      }
      const stored = await writes.lookup("time_entries", id);
      const own = roundingRuleTextSchema.safeDecode(stored.rounding_rule);
      if (!own.success) throw inputError(["ruleByHand"], ROUNDING_RULE_UNKNOWN);
      const rule =
        ruleByHand === undefined
          ? { rule: own.data, ruleChosenByHand: stored.rule_chosen_by_hand === 1 }
          : ruleByHand === null
            ? { rule: ruleThatHolds(), ruleChosenByHand: false }
            : { rule: ruleByHand, ruleChosenByHand: true };
      return toTimeEntry(
        await writes.update("time_entries", id, {
          ...roundedColumns({
            startedAt: startedAt ?? stored.started_at,
            endedAt: endedAt ?? stored.ended_at,
            timeZone: stored.time_zone,
            ...rule,
          }),
          project_id: projectId,
          note,
        }),
      );
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toTimeEntry(await sharedWrites(tx, context).softDelete("time_entries", input.id));
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toTimeEntry(await sharedWrites(tx, context).restore("time_entries", input.id));
    },
  },
  entry: {
    kind: "query",
    reads: TIME_TRACKING_READS.entry,
    async run(tx, context, input) {
      const row = await liveEntriesWithProject(tx, context)
        .where("time_entries.id", "=", input.id)
        .executeTakeFirst();
      return row === undefined ? null : toTimeEntryWithProject(row);
    },
  },
  days: { kind: "query", reads: TIME_TRACKING_READS.days, run: spanDays },
  startTimer: {
    kind: "operation",
    // The frame's reference check refuses a deleted or unknown project; an archived one is a
    // valid target (D330, D337).
    // One timer at a time is a flow of the Operation (D310, D349): it stops the others first.
    async run(tx, context, input) {
      const others = await stopRunningTimers(tx, context);
      const timer = toTimer(
        await sharedWrites(tx, context).insert("timers", context.newId(timerIdSchema), {
          // The Data Process's Clock, never the page's (D348), on the whole second (D344).
          started_at: wholeSecondOf(context.now),
          project_id: input.projectId ?? null,
          note: input.note ?? null,
        }),
      );
      return { timer, others };
    },
  },
  editTimer: {
    kind: "operation",
    edit: true,
    async run(tx, context, input) {
      const startedAt = input.startedAt === undefined ? undefined : wholeSecondOf(input.startedAt);
      // Instants of the supported years compare as text in time order.
      if (startedAt !== undefined && startedAt > context.now)
        throw inputError(["startedAt"], START_IN_FUTURE);
      return toTimer(
        await sharedWrites(tx, context).update("timers", input.id, {
          started_at: startedAt,
          project_id: input.projectId,
          note: input.note,
        }),
      );
    },
  },
  stopTimer: { kind: "operation", run: stopTimer },
  discardTimer: {
    kind: "operation",
    async run(tx, context, input) {
      return toTimer(await sharedWrites(tx, context).softDelete("timers", input.id));
    },
  },
  undoStopTimer: { kind: "operation", run: undoStopTimer },
  undoDiscardTimer: { kind: "operation", run: undoDiscardTimer },
  // Small: one timer runs through the app's own Operations, a few after a sync (D310).
  runningTimers: smallSetList(TIME_TRACKING_READS.runningTimers, async (tx, context) =>
    (await runningTimers(tx, context).execute()).map(toTimerWithProject),
  ),
});
