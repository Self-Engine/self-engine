import type { TablesOf } from "@self-engine/db";
import type { ReadTransaction, StorageContext } from "@self-engine/storage";
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
