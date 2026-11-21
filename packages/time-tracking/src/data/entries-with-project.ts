import type { TablesOf } from "@self-engine/db";
import {
  type JoinedProject,
  projectReferenceColumns,
  projectReferenceOf,
  projectReferences,
} from "@self-engine/projects/data";
import { type ReadTransaction, sharedEntry, type StorageContext } from "@self-engine/storage";
import type { TimeEntryWithProject } from "../contracts/index.ts";
import {
  TIME_ENTRY_COLUMNS,
  type TimeEntryValues,
  type timeTrackingRowMap,
  toTimeEntry,
} from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/**
 * The Live Rows of `time_entries` with their Project Reference: the base of every Query that
 * answers entries. The Read Piece of `projects` is joined as `project`, so a Query filters and
 * sorts by `project.title` and its other fields; a left join keeps an entry without a project.
 */
export function liveEntriesWithProject(tx: ReadTransaction<Tables>, context: StorageContext) {
  return sharedEntry<Tables>(tx, context)
    .live("time_entries")
    .leftJoin(projectReferences(tx, context, "project"), "project.id", "time_entries.project_id")
    .select(TIME_ENTRY_COLUMNS)
    .select(projectReferenceColumns("project"));
}

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toTimeEntryWithProject = (
  row: TimeEntryValues & JoinedProject,
): TimeEntryWithProject => ({ ...toTimeEntry(row), project: projectReferenceOf(row) });
