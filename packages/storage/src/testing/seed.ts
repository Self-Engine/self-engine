import type { TablesOf } from "@self-engine/db";
import type { Transaction } from "kysely";
import type { RowMap, StorageContext } from "../core/index.ts";

export type Seed<Rows extends RowMap> = (
  tx: Transaction<TablesOf<Rows>>,
  context: StorageContext,
) => void | Promise<void>;
