import type { TablesOf } from "@self-engine/db";
import type { StorageContext, WriteTransaction } from "@self-engine/storage";
import type { TimeEntry, TimeEntryId } from "../contracts/index.ts";
import { type StoredShare, type WeightedProject, writeProjectShares } from "./project-shares.ts";
import { type EntryComputation, roundedColumns } from "./rounded-columns.ts";
import { type TimeEntryValues, type timeTrackingRowMap, toTimeEntry } from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/** The columns of an entry's row that `roundedColumns` computes. */
export type RoundedEntryColumns = ReturnType<typeof roundedColumns>["columns"];

/**
 * The end of every write of a Time Entry (ADR 0044): the columns of `roundedColumns`, the row's
 * own write with them (`write`: insert, update or restore), then the entry's Project Shares as the
 * same computation divided them, matched against `sharesBefore`. The shares before are passed as
 * read, or as a read after the row's write where the entry may be deleted before it: a deleted
 * entry's shares are absent until it lives again (ADR 0042).
 */
export async function writeEntry(
  tx: WriteTransaction<Tables>,
  context: StorageContext,
  entry: EntryComputation & { readonly projects: readonly WeightedProject[] },
  write: (columns: RoundedEntryColumns) => Promise<TimeEntryValues & { readonly id: TimeEntryId }>,
  sharesBefore: readonly StoredShare[] | ((id: TimeEntryId) => Promise<readonly StoredShare[]>),
): Promise<TimeEntry> {
  const { columns, projectShares } = roundedColumns(entry);
  const row = await write(columns);
  const before = typeof sharesBefore === "function" ? await sharesBefore(row.id) : sharesBefore;
  return toTimeEntry(
    row,
    await writeProjectShares(tx, context, row.id, entry.projects, projectShares, before),
  );
}
