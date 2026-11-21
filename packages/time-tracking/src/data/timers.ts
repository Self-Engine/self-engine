import type { TablesOf } from "@self-engine/db";
import {
  type JoinedProject,
  projectReferenceColumns,
  projectReferenceOf,
  projectReferences,
} from "@self-engine/projects/data";
import { type ReadTransaction, sharedEntry, type StorageContext } from "@self-engine/storage";
import type { TimerWithProject } from "../contracts/index.ts";
import { TIMER_COLUMNS, type TimerValues, type timeTrackingRowMap, toTimer } from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/**
 * The Live Rows of `timers` with their Project Reference, the most recently started first: the
 * running timers. The Read Piece of `projects` is joined as `project`; a left join keeps a timer
 * without a project. The id breaks a tie, so two timers of the same second keep their order.
 */
export function runningTimers(tx: ReadTransaction<Tables>, context: StorageContext) {
  return sharedEntry<Tables>(tx, context)
    .live("timers")
    .leftJoin(projectReferences(tx, context, "project"), "project.id", "timers.project_id")
    .select(TIMER_COLUMNS)
    .select(projectReferenceColumns("project"))
    .orderBy("timers.started_at", "desc")
    .orderBy("timers.id", "desc");
}

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toTimerWithProject = (row: TimerValues & JoinedProject): TimerWithProject => ({
  ...toTimer(row),
  project: projectReferenceOf(row),
});
