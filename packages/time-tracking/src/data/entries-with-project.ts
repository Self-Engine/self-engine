import type { TablesOf } from "@self-engine/db";
import {
  type JoinedProject,
  projectReferenceColumns,
  projectReferenceOf,
  projectReferences,
} from "@self-engine/projects/data";
import { type ReadTransaction, sharedEntry, type StorageContext } from "@self-engine/storage";
import type { ListedTimeEntry, TimeEntryWithProject } from "../contracts/index.ts";
import {
  LISTED_TIME_ENTRY_COLUMNS,
  type ListedTimeEntryValues,
  TIME_ENTRY_COLUMNS,
  type TimeEntryValues,
  type timeTrackingRowMap,
  toListedTimeEntry,
  toTimeEntry,
} from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/**
 * The Live Rows of `time_entries` with their Project Reference: the base of every Query that
 * answers entries. The Read Piece of `projects` is joined as `project`, so a Query filters and
 * sorts by `project.title` and its other fields; a left join keeps an entry without a project.
 */
function liveWithProject(tx: ReadTransaction<Tables>, context: StorageContext) {
  return sharedEntry<Tables>(tx, context)
    .live("time_entries")
    .leftJoin(projectReferences(tx, context, "project"), "project.id", "time_entries.project_id")
    .select(projectReferenceColumns("project"));
}

/** The entries with everything one entry answers, its rule among it. */
export function liveEntriesWithProject(tx: ReadTransaction<Tables>, context: StorageContext) {
  return liveWithProject(tx, context).select(TIME_ENTRY_COLUMNS);
}

/** The entries as a list reads them: without the rule, which a list does not parse. */
export function listedEntriesWithProject(tx: ReadTransaction<Tables>, context: StorageContext) {
  return liveWithProject(tx, context).select(LISTED_TIME_ENTRY_COLUMNS);
}

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toTimeEntryWithProject = (
  row: TimeEntryValues & JoinedProject,
): TimeEntryWithProject => ({ ...toTimeEntry(row), project: projectReferenceOf(row) });

export const toListedTimeEntryWithProject = (
  row: ListedTimeEntryValues & JoinedProject,
): ListedTimeEntry => ({ ...toListedTimeEntry(row), project: projectReferenceOf(row) });
