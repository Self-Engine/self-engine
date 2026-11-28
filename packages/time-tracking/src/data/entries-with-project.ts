import type { TablesOf } from "@self-engine/db";
import { type ReadTransaction, sharedEntry, type StorageContext } from "@self-engine/storage";
import type { ListedTimeEntry, TimeEntryWithProject } from "../contracts/index.ts";
import { projectsOfEntries } from "./project-shares.ts";
import {
  LISTED_TIME_ENTRY_COLUMNS,
  TIME_ENTRY_COLUMNS,
  type timeTrackingRowMap,
  toListedTimeEntry,
  toTimeEntry,
} from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/** The entries with everything one entry answers, its rule among it. */
export function liveEntries(tx: ReadTransaction<Tables>, context: StorageContext) {
  return sharedEntry<Tables>(tx, context).live("time_entries").select(TIME_ENTRY_COLUMNS);
}

/** The entries as a list reads them: without the rule, which a list does not parse. */
export function listedEntries(tx: ReadTransaction<Tables>, context: StorageContext) {
  return sharedEntry<Tables>(tx, context).live("time_entries").select(LISTED_TIME_ENTRY_COLUMNS);
}

type EntryRow = Awaited<ReturnType<ReturnType<typeof liveEntries>["execute"]>>[number];
type ListedRow = Awaited<ReturnType<ReturnType<typeof listedEntries>["execute"]>>[number];

/** One entry with the Project Reference of each of its projects: one more read for its shares. */
export async function withProjects(
  tx: ReadTransaction<Tables>,
  context: StorageContext,
  row: EntryRow,
): Promise<TimeEntryWithProject> {
  const projectShares = (await projectsOfEntries(tx, context, [row.id])).get(row.id) ?? [];
  return { ...toTimeEntry(row, projectShares), projectShares };
}

/**
 * The entries of a list with the Project References of their projects: one more read for the
 * shares of all of them, not one per entry.
 */
export async function listedWithProjects(
  tx: ReadTransaction<Tables>,
  context: StorageContext,
  rows: readonly ListedRow[],
): Promise<ListedTimeEntry[]> {
  const shares = await projectsOfEntries(
    tx,
    context,
    rows.map(({ id }) => id),
  );
  return rows.map((row) => ({
    ...toListedTimeEntry(row),
    projectShares: shares.get(row.id) ?? [],
  }));
}
