import { portHooks } from "@self-engine/data-client/react";
import type { TablesOf } from "@self-engine/db";
import type { DaySpan } from "@self-engine/time";
import { useMemo } from "react";
import type { TimeEntryFilter, timeTrackingContract } from "./contracts/index.ts";
import type { timeTrackingRowMap } from "./data/rows.ts";

export type {
  DayEntry,
  DaysAnswer,
  ProjectTotal,
  SpanDay,
  TimeEntryWithProject,
  Timer,
  TimerId,
  TimerStart,
  TimerStop,
  TimerUndo,
  TimerWithProject,
} from "./contracts/index.ts";

// The module's hooks, built from its Contract and its mount name (D249). The Contract arrives as a
// type only, so its schemas never load with a View (D255); the module names no tables (D248).
// Its tables type where a form shows a Reason (D334), also as a type only.
const timeTrackingPort = portHooks<
  typeof timeTrackingContract,
  TablesOf<typeof timeTrackingRowMap>
>("timeTracking");

/** The frame refuses a deleted project at the column; the form shows it at the project (D334). */
const AT_PROJECT = { columns: { time_entries: { project_id: "projectId" } } } as const;

/** One stored entry with its Project Reference, for the Edit Drawer; `null` once it is gone. */
export const useTimeEntry = timeTrackingPort.query("entry");
export const useCreateTimeEntry = timeTrackingPort.operation("create", AT_PROJECT);
export const useEditTimeEntry = timeTrackingPort.operation("edit", AT_PROJECT);
export const useDeleteTimeEntry = timeTrackingPort.operation("delete");
export const useRestoreTimeEntry = timeTrackingPort.operation("restore");

/**
 * `create` for the input Command, which runs outside React and is given the Port access (D261).
 * It shows no field: a Refusal goes to the Notice.
 */
export const createTimeEntry = timeTrackingPort.run("create");

const useDays = timeTrackingPort.query("days");

/**
 * The entries and sums of a Day Span (D354). It takes the span as `weekOf` computes it: the
 * Query's own input is the schema's input, plain text, and would take any two strings.
 */
export function useSpanDays(span: DaySpan, filter?: TimeEntryFilter) {
  const { first, last } = span;
  const input = useMemo(
    () => (filter === undefined ? { span: { first, last } } : { span: { first, last }, filter }),
    [first, last, filter],
  );
  return useDays(input);
}

/** The frame refuses a deleted project at the timer's column (D334, D337). */
const AT_TIMER_PROJECT = { columns: { timers: { project_id: "projectId" } } } as const;

const useRunning = timeTrackingPort.query("runningTimers");

/**
 * The running Timers with their Project References, the most recently started first (D310). It
 * follows every Operation through the Table Change alone; nothing reads it on a clock.
 */
export function useRunningTimers() {
  return useRunning(undefined);
}

export const useStartTimer = timeTrackingPort.operation("startTimer", AT_TIMER_PROJECT);
export const useEditTimer = timeTrackingPort.operation("editTimer", AT_TIMER_PROJECT);
export const useStopTimer = timeTrackingPort.operation("stopTimer");
export const useDiscardTimer = timeTrackingPort.operation("discardTimer");
export const useUndoStopTimer = timeTrackingPort.operation("undoStopTimer");
export const useUndoDiscardTimer = timeTrackingPort.operation("undoDiscardTimer");

// The same Operations as functions of the Port access, for code outside React (D261): the timer's
// actions with their Notices, which the Module Indicator, a Command and the Indicator Panel share.
// None of them shows a field, so a Refusal goes to the Notice.
export const startTimer = timeTrackingPort.run("startTimer");
export const stopTimer = timeTrackingPort.run("stopTimer");
export const discardTimer = timeTrackingPort.run("discardTimer");
export const undoStopTimer = timeTrackingPort.run("undoStopTimer");
export const undoDiscardTimer = timeTrackingPort.run("undoDiscardTimer");
