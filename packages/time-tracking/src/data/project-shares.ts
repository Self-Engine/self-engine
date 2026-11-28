// The Project Shares of a Time Entry (ADR 0044): one Part Row per project of an entry (ADR 0042),
// read and written only through the shared entry and writes, so a share counts exactly while its
// entry is a Live Row. A Query that reads them names `time_entries` among its reads.
import type { TablesOf } from "@self-engine/db";
import type { ProjectId } from "@self-engine/projects/ids";
import {
  projectReferenceColumns,
  projectReferenceOf,
  projectReferences,
} from "@self-engine/projects/data";
import {
  type ReadTransaction,
  sharedEntry,
  sharedWrites,
  type StorageContext,
  type WriteTransaction,
} from "@self-engine/storage";
import type { Duration } from "@self-engine/time";
import {
  type ProjectShare,
  type ProjectShareWithProject,
  projectShareIdSchema,
  type TimeEntryId,
} from "../contracts/index.ts";
import type { timeTrackingRowMap } from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/** One project of an entry as a write divides with it: its Weight is stated. */
export interface WeightedProject {
  readonly projectId: ProjectId;
  readonly weight: number;
}

/**
 * The list create and edit take, with every Weight stated: a project without one has the Weight
 * 1, so a list without Weights divides in equal parts.
 */
export function weightedProjects(
  projects: readonly { readonly projectId: ProjectId; readonly weight?: number | undefined }[],
): WeightedProject[] {
  return projects.map(({ projectId, weight }) => ({ projectId, weight: weight ?? 1 }));
}

/** The Lead Project: the first of the list, whose rule rounds the entry; `null` without one. */
export const leadProjectOf = (projects: readonly WeightedProject[]) =>
  projects[0]?.projectId ?? null;

/** The live shares of one entry in their order, the Lead Project first. */
function sharesOfEntry(tx: ReadTransaction<Tables>, context: StorageContext, id: TimeEntryId) {
  return sharedEntry(tx, context)
    .live("project_shares")
    .select([
      "project_shares.id",
      "project_shares.project_id",
      "project_shares.place",
      "project_shares.weight",
      "project_shares.project_share",
    ])
    .where("project_shares.time_entry_id", "=", id)
    .orderBy("project_shares.place")
    .orderBy("project_shares.id")
    .execute();
}

type StoredShare = Awaited<ReturnType<typeof sharesOfEntry>>[number];

const toProjectShare = (row: Omit<StoredShare, "id" | "place">): ProjectShare => ({
  projectId: row.project_id,
  weight: row.weight,
  projectShare: row.project_share,
});

/** The projects of a stored entry, as a write divides with them when the edit keeps the list. */
export async function storedProjects(
  tx: ReadTransaction<Tables>,
  context: StorageContext,
  id: TimeEntryId,
) {
  const rows = await sharesOfEntry(tx, context, id);
  return {
    rows,
    projects: rows.map(({ project_id, weight }) => ({ projectId: project_id, weight })),
    shares: rows.map(toProjectShare),
  };
}

/**
 * Writes the entry's list of projects with the shares the computation divided, in the same
 * transaction as the entry: a project already in the list keeps its row, a new one gets a new row,
 * and a removed one is soft-deleted, so adding it again makes a new row. A row that stays as it is
 * is not written. `stored` are the entry's live shares before the write.
 */
export async function writeProjectShares(
  tx: WriteTransaction<Tables>,
  context: StorageContext,
  entry: TimeEntryId,
  projects: readonly WeightedProject[],
  shares: readonly Duration[],
  stored: readonly StoredShare[],
): Promise<ProjectShare[]> {
  const writes = sharedWrites(tx, context);
  const unmatched = [...stored];
  const written: ProjectShare[] = [];
  for (const [place, { projectId, weight }] of projects.entries()) {
    const projectShare = shares[place];
    if (projectShare === undefined) throw new Error("The computation divides every project");
    const at = unmatched.findIndex((row) => row.project_id === projectId);
    const [kept] = at === -1 ? [] : unmatched.splice(at, 1);
    const values = { place, weight, project_share: projectShare };
    if (kept === undefined)
      await writes.insert("project_shares", context.newId(projectShareIdSchema), {
        time_entry_id: entry,
        project_id: projectId,
        ...values,
      });
    else if (kept.place !== place || kept.weight !== weight || kept.project_share !== projectShare)
      await writes.update("project_shares", kept.id, values);
    written.push({ projectId, weight, projectShare });
  }
  for (const removed of unmatched) await writes.softDelete("project_shares", removed.id);
  return written;
}

/**
 * The live shares of many entries with their Project References, in one read: the one place that
 * reads shares for a Query, so every sum per project counts only shares of Live Rows (ADR 0042).
 * Answers each entry's shares in their order, the Lead Project first.
 */
export async function projectsOfEntries(
  tx: ReadTransaction<Tables>,
  context: StorageContext,
  ids: readonly TimeEntryId[],
): Promise<ReadonlyMap<TimeEntryId, ProjectShareWithProject[]>> {
  const byEntry = new Map<TimeEntryId, ProjectShareWithProject[]>();
  if (ids.length === 0) return byEntry;
  const rows = await sharedEntry(tx, context)
    .live("project_shares")
    .innerJoin(projectReferences(tx, context, "project"), "project.id", "project_shares.project_id")
    .select(projectReferenceColumns("project"))
    .select([
      "project_shares.time_entry_id",
      "project_shares.project_id",
      "project_shares.weight",
      "project_shares.project_share",
    ])
    .where("project_shares.time_entry_id", "in", ids)
    .orderBy("project_shares.time_entry_id")
    .orderBy("project_shares.place")
    .orderBy("project_shares.id")
    .execute();
  for (const row of rows) {
    // The inner join keeps only shares whose project has a row: every project has one (D337).
    const project = projectReferenceOf(row);
    if (project === null) continue;
    const shares = byEntry.get(row.time_entry_id) ?? [];
    shares.push({ ...toProjectShare(row), project });
    byEntry.set(row.time_entry_id, shares);
  }
  return byEntry;
}
