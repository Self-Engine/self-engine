import { defineStorageModule, inputError, sharedWrites, smallSetList } from "@self-engine/storage";
import { wholeSecondOf } from "@self-engine/time";
import {
  NOT_WORK_HAS_RULE_BY_HAND,
  START_IN_FUTURE,
  timeEntryIdSchema,
  timerIdSchema,
  timeTrackingContract,
} from "../contracts/index.ts";
import { spanDays } from "./days.ts";
import { liveEntries, withProjects } from "./entries-with-project.ts";
import {
  leadProjectOf,
  storedProjects,
  weightedProjects,
  writeProjectShares,
} from "./project-shares.ts";
import { TIME_TRACKING_READS } from "./reads.ts";
import { ownBreaks, ownRule, shiftedBy } from "./own-columns.ts";
import { roundedColumns, ruleThatHolds } from "./rounded-columns.ts";
import { timeTrackingMigrations, timeTrackingRowMap, toTimeEntry, toTimer } from "./rows.ts";
import { stopRunningTimers, stopTimer } from "./stop-timer.ts";
import { runningTimers, toTimerWithProject } from "./timers.ts";
import { undoDiscardTimer, undoStopTimer } from "./undo-timer.ts";

/**
 * The Storage of `time-tracking` (D252). It registers no Protection Rule: "end after start" is a
 * check of the input, and overlapping entries are valid data (D311). It refers to `projects`
 * through the Project Shares and reads it through its Read Piece; `projects` knows nothing of it
 * (D308).
 */
export const timeTracking = defineStorageModule({
  name: "timeTracking",
  contract: timeTrackingContract,
  migrations: timeTrackingMigrations,
  rowMap: timeTrackingRowMap,
  // A project's Rounding Rules are live only while their project is, an entry's Project Shares
  // only while their entry is (ADR 0042, ADR 0044).
  belongsTo: { rounding_rules: "project_id", project_shares: "time_entry_id" },
}).entries({
  create: {
    kind: "operation",
    // The frame's reference check refuses a deleted or unknown project; an archived one is a
    // valid target (D330, D337).
    async run(tx, context, input) {
      // The zone the call computes with, read in its transaction (D342, D353).
      const timeZone = await context.readTimeZone(tx);
      const timeKind = input.timeKind ?? "work";
      // An entry that is not work takes the app-wide rule; its empty lists mean "none".
      const byHand =
        input.timeKind === undefined || input.timeKind === "work"
          ? (input.ruleByHand ?? undefined)
          : undefined;
      const projects = weightedProjects(input.projects ?? []);
      const rule =
        byHand ??
        (await ruleThatHolds(tx, context, {
          projectId: leadProjectOf(projects),
          startedAt: input.startedAt,
        }));
      const { columns, projectShares } = roundedColumns({
        timeKind,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        timeZone,
        rule,
        ruleChosenByHand: byHand !== undefined,
        breaks: input.breaks ?? [],
        projects,
      });
      const row = await sharedWrites(tx, context).insert(
        "time_entries",
        context.newId(timeEntryIdSchema),
        { ...columns, note: input.note ?? null, time_zone: timeZone },
      );
      return toTimeEntry(
        row,
        await writeProjectShares(tx, context, row.id, projects, projectShares, []),
      );
    },
  },
  edit: {
    kind: "operation",
    edit: true,
    // Every edit rounds again with the entry's own rule in its own Time Zone and divides its
    // Booked Duration again (ADR 0044): one lookup of the row and one of its shares before the
    // write. The list of projects is replaced as a whole.
    async run(tx, context, input) {
      const { id, timeKind, startedAt, endedAt, ruleByHand, note, breaks } = input;
      const writes = sharedWrites(tx, context);
      const fields = [timeKind, startedAt, ruleByHand, input.projects, note, breaks];
      if (fields.every((field) => field === undefined)) {
        const row = await writes.update("time_entries", id, {});
        return toTimeEntry(row, (await storedProjects(tx, context, id)).shares);
      }
      const stored = await writes.lookup("time_entries", id);
      // An entry whose stored rule this version cannot read is kept as it is.
      const own = ownRule(stored);
      const kind = timeKind ?? stored.time_kind;
      const isWork = kind === "work";
      // An entry that is not work takes the app-wide rule, never one chosen by hand.
      if (!isWork && ruleByHand != null)
        throw inputError(["ruleByHand"], NOT_WORK_HAS_RULE_BY_HAND);
      const before = await storedProjects(tx, context, id);
      const projects =
        input.projects === undefined ? before.projects : weightedProjects(input.projects);
      // "Look up again" asks for the rule of the entry as it stands after the edit. An entry that
      // stops being Work takes the app-wide rule that held at its start, without the mark "chosen
      // by hand"; one that becomes Work keeps its rule unless the same edit looks up again.
      const start = startedAt ?? stored.started_at;
      const leavesWork = !isWork && stored.time_kind === "work";
      const lookUp = ruleByHand === null || leavesWork;
      const rule =
        ruleByHand != null
          ? { rule: ruleByHand, ruleChosenByHand: true }
          : lookUp
            ? {
                rule: await ruleThatHolds(tx, context, {
                  projectId: isWork ? leadProjectOf(projects) : null,
                  startedAt: start,
                }),
                ruleChosenByHand: false,
              }
            : own;
      const { columns, projectShares } = roundedColumns({
        timeKind: kind,
        // A change of kind removes the mark, as setting a break back by hand does.
        changedByLimit: kind === stored.time_kind && stored.changed_by_limit === 1,
        startedAt: start,
        endedAt: endedAt ?? stored.ended_at,
        timeZone: stored.time_zone,
        ...rule,
        // The list is replaced as a whole; without one the stored list is kept and checked.
        breaks: breaks ?? ownBreaks(stored),
        projects,
      });
      const row = await writes.update("time_entries", id, { ...columns, note });
      return toTimeEntry(
        row,
        await writeProjectShares(tx, context, id, projects, projectShares, before.rows),
      );
    },
  },
  move: {
    kind: "operation",
    // One lookup of the row and one of its shares before the write, as an edit: the entry rounds
    // with its own rule and keeps its projects, whose shares are divided again.
    async run(tx, context, input) {
      const writes = sharedWrites(tx, context);
      const stored = await writes.lookup("time_entries", input.id);
      const rule = ownRule(stored);
      const before = await storedProjects(tx, context, input.id);
      const shift = shiftedBy(stored.started_at, wholeSecondOf(input.startedAt));
      const { columns, projectShares } = roundedColumns({
        timeKind: stored.time_kind,
        changedByLimit: stored.changed_by_limit === 1,
        startedAt: shift(stored.started_at),
        endedAt: shift(stored.ended_at),
        timeZone: stored.time_zone,
        ...rule,
        breaks: ownBreaks(stored).map((stretch) => ({
          ...stretch,
          startedAt: shift(stretch.startedAt),
          endedAt: shift(stretch.endedAt),
        })),
        projects: before.projects,
      });
      const row = await writes.update("time_entries", input.id, columns);
      return toTimeEntry(
        row,
        await writeProjectShares(
          tx,
          context,
          input.id,
          before.projects,
          projectShares,
          before.rows,
        ),
      );
    },
  },
  // Delete and restore change only the entry's row: its shares are Part Rows (ADR 0042).
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      // Read while the entry lives: the shares of a deleted entry are absent.
      const { shares } = await storedProjects(tx, context, input.id);
      const row = await sharedWrites(tx, context).softDelete("time_entries", input.id);
      return toTimeEntry(row, shares);
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      const row = await sharedWrites(tx, context).restore("time_entries", input.id);
      return toTimeEntry(row, (await storedProjects(tx, context, input.id)).shares);
    },
  },
  entry: {
    kind: "query",
    reads: TIME_TRACKING_READS.entry,
    async run(tx, context, input) {
      const row = await liveEntries(tx, context)
        .where("time_entries.id", "=", input.id)
        .executeTakeFirst();
      return row === undefined ? null : withProjects(tx, context, row);
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
