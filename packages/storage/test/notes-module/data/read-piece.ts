import type { TablesOf } from "@self-engine/db";
import type { Transaction } from "kysely";
import type { ReadTransaction, StorageContext } from "../../../src/core/index.ts";
import type { notesRowMap } from "./rows.ts";

/**
 * Released columns only. Deleted targets remain available, explicitly marked. It takes the
 * consumer's read or write transaction as it is, whatever row map that one is typed from.
 */
export function noteTitles<DB, Alias extends string>(
  tx: ReadTransaction<DB> | Transaction<DB>,
  context: StorageContext,
  alias: Alias,
) {
  // Only the owner supplies this table's type; consumers keep their own row maps.
  const reads = tx as unknown as ReadTransaction<TablesOf<typeof notesRowMap>>;
  return reads
    .selectFrom("notes")
    .select(["id", "title", "deleted_at as deletedAt"])
    .where("space_id", "=", context.spaceId)
    .as(alias);
}
