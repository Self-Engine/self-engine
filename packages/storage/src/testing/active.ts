import { call, ORPCError, type AnyProcedure } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import {
  createContext,
  createFrame,
  type RowMap,
  type StorageContract,
  type StorageModule,
} from "../core/index.ts";
import { createTestContext, createTestDatabase } from "./helpers.ts";
import { returnsSeededRow } from "./scoping.ts";
import type { Seed } from "./seed.ts";
import type { ContractViolation } from "./violation.ts";

/** The module's own synchronized tables that carry the archive column (D327). */
function archivableTables(rowMap: RowMap) {
  return Object.entries(rowMap)
    .filter(([name, schema]) => !name.startsWith("local_") && Object.hasOwn(schema.shape, "archived_at"))
    .map(([name]) => name);
}

/**
 * A Query declared `active` answers from Live Rows that are not archived. The kit archives every
 * seeded Live Row of the module's archivable tables and fails the Query if its answer still
 * contains one of them, at any depth, by its `id`.
 */
export async function checkActiveQuery<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  seed: Seed<Rows>,
  entry: string,
  example: unknown,
  dependencies: readonly { readonly migrations: StorageModule<Contract, Rows>["migrations"] }[],
): Promise<ContractViolation[]> {
  const tables = archivableTables(module.rowMap);
  if (tables.length === 0) return [{ entry, rule: "active query has no archivable table" }];
  const database = await createTestDatabase(module, dependencies);
  try {
    const sources = createTestContext();
    const context = createContext(sources);
    const archived = new Set<string>();
    await database.kysely.transaction().execute(async (transaction) => {
      await seed(transaction.withTables<TablesOf<Rows>>(), context);
      const tx =
        transaction.withTables<
          Record<string, { id: string; deleted_at: string | null; archived_at: string | null }>
        >();
      for (const table of tables) {
        await tx
          .updateTable(table)
          .set({ archived_at: context.now })
          .where("deleted_at", "is", null)
          .where("archived_at", "is", null)
          .execute();
        const rows = await tx
          .selectFrom(table)
          .select("id")
          .where("deleted_at", "is", null)
          .execute();
        for (const row of rows) archived.add(row.id);
      }
    });
    const router: Record<string, AnyProcedure> = createFrame(module, {
      database,
      sources,
      checkOutputs: false,
    });
    const target = router[entry];
    if (target === undefined) throw new Error(`Missing module function: ${entry}`);
    try {
      if (returnsSeededRow(await call(target, example), archived))
        return [{ entry, rule: "active query returns an archived row" }];
    } catch (error) {
      if (!(error instanceof ORPCError) || error.code !== "NOT_FOUND") throw error;
    }
    return [];
  } finally {
    await database.close();
  }
}
