import type { TablesOf } from "@self-engine/db";
import type { Transaction } from "kysely";
import type { RowMap, StorageContext } from "../core/index.ts";

/**
 * Creates a module's example rows. The kit runs it once per database for the given Space and
 * again for other Spaces, so every insert must succeed on a repeated run: derive ids from the
 * context, and make inserts into Local Tables (which have no Space) idempotent.
 */
export type Seed<Rows extends RowMap> = (
  tx: Transaction<TablesOf<Rows>>,
  context: StorageContext,
) => void | Promise<void>;
