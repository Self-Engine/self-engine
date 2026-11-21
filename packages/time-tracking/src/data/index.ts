import { defineStorageModule, inputError, sharedWrites, smallSetList } from "@self-engine/storage";
import { wholeSecondOf } from "@self-engine/time";
import {
  START_IN_FUTURE,
  timeEntryIdSchema,
  timerIdSchema,
  timeTrackingContract,
} from "../contracts/index.ts";
import { spanDays } from "./days.ts";
import { liveEntriesWithProject, toTimeEntryWithProject } from "./entries-with-project.ts";
import { TIME_TRACKING_READS } from "./reads.ts";
import {
  storedTimes,
  timeTrackingMigrations,
  timeTrackingRowMap,
  toTimeEntry,
  toTimer,
} from "./rows.ts";
import { stopRunningTimers, stopTimer } from "./stop-timer.ts";
import { runningTimers, toTimerWithProject } from "./timers.ts";

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
      return toTimeEntry(
        await sharedWrites(tx, context).insert("time_entries", context.newId(timeEntryIdSchema), {
          ...storedTimes(input.startedAt, input.endedAt),
          project_id: input.projectId ?? null,
          note: input.note ?? null,
          // The zone the call computes with, read in its transaction (D342, D353).
          time_zone: await context.readTimeZone(tx),
        }),
      );
    },
  },
  edit: {
    kind: "operation",
    edit: true,
    async run(tx, context, input) {
      const { startedAt, endedAt } = input;
      return toTimeEntry(
        await sharedWrites(tx, context).update("time_entries", input.id, {
          ...(startedAt === undefined ? {} : storedTimes(startedAt, endedAt)),
          project_id: input.projectId,
          note: input.note,
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
  // Small: one timer runs through the app's own Operations, a few after a sync (D310).
  runningTimers: smallSetList(TIME_TRACKING_READS.runningTimers, async (tx, context) =>
    (await runningTimers(tx, context).execute()).map(toTimerWithProject),
  ),
});
