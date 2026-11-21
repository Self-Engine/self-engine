import type { TablesOf } from "@self-engine/db";
import type { ReadTransaction, StorageContext } from "@self-engine/storage";
import type { ProjectReference } from "../contracts/project-reference.ts";
import type { projectsRowMap } from "./rows.ts";

/**
 * The Read Piece of `projects` (D241, D330): the project reference for the Queries of a module
 * above, which joins it in its own Query, as `alias`, and may sort and filter by it. It gives the
 * six released fields of `projectReferenceSchema`, scoped to the current Space. An archived and a
 * deleted project stay visible with their marks, so an entry never loses its project; the
 * consumer decides what to hide. It takes the consumer's read or write transaction as it is,
 * whatever row map that one is typed from.
 */
export function projectReferences<DB, Alias extends string>(
  tx: ReadTransaction<DB>,
  context: StorageContext,
  alias: Alias,
) {
  // Only `projects` supplies its table's type; a consumer keeps its own row map.
  const reads = tx as unknown as ReadTransaction<TablesOf<typeof projectsRowMap>>;
  return reads
    .selectFrom("projects")
    .select([
      "id",
      "title",
      "icon",
      "color",
      "archived_at as archivedAt",
      "deleted_at as deletedAt",
    ])
    .where("space_id", "=", context.spaceId)
    .as(alias);
}

/**
 * The columns a Query of a module above selects from the Read Piece joined as `alias`, named so
 * they cannot collide with its own columns; they give the fields of `JoinedProject`.
 */
export function projectReferenceColumns<Alias extends string>(alias: Alias) {
  return [
    `${alias}.id as projectRefId`,
    `${alias}.title as projectTitle`,
    `${alias}.icon as projectIcon`,
    `${alias}.color as projectColor`,
    `${alias}.archivedAt as projectArchivedAt`,
    `${alias}.deletedAt as projectDeletedAt`,
  ] as const;
}

/** The columns of `projectReferenceColumns` in a row of a left join: `null` where no project was found. */
export interface JoinedProject {
  readonly projectRefId: ProjectReference["id"] | null;
  readonly projectTitle: string | null;
  readonly projectIcon: string | null;
  readonly projectColor: string | null;
  readonly projectArchivedAt: ProjectReference["archivedAt"];
  readonly projectDeletedAt: ProjectReference["deletedAt"];
}

/** The joined Read Piece as a Project Reference; `null` when no project of this Space was found. */
export function projectReferenceOf(row: JoinedProject): ProjectReference | null {
  if (row.projectRefId === null || row.projectTitle === null) return null;
  return {
    id: row.projectRefId,
    title: row.projectTitle,
    icon: row.projectIcon,
    color: row.projectColor,
    archivedAt: row.projectArchivedAt,
    deletedAt: row.projectDeletedAt,
  };
}
