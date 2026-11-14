import { call, ORPCError } from "@orpc/server";
import { type RowMap, type StorageContract, type StorageModule } from "../core/index.ts";
import { createSeededDatabase, frameEntry } from "./kit-setup.ts";
import { returnsSeededRow } from "./scoping.ts";
import type { Seed } from "./seed.ts";
import type { ContractViolation } from "./violation.ts";

/** The module's own synchronized tables that carry the archive column (D327). */
function archivableTables(rowMap: RowMap) {
  return Object.entries(rowMap)
    .filter(
      ([name, schema]) => !name.startsWith("local_") && Object.hasOwn(schema.shape, "archived_at"),
    )
    .map(([name]) => name);
}

/**
 * A Query declared `active` answers from Live Rows that are not archived. The kit archives every
 * seeded Live Row of the module's archivable tables and fails the Query if its answer still
 * contains one of them, at any depth, by its `id`. A seed without such a Live Row fails the Query,
 * since the check would prove nothing.
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
  const archived = new Set<string>();
  let archivedLive = 0n;
  const { database, sources } = await createSeededDatabase(
    module,
    dependencies,
    seed,
    async (transaction, context) => {
      const tx =
        transaction.withTables<
          Record<string, { id: string; deleted_at: string | null; archived_at: string | null }>
        >();
      for (const table of tables) {
        const [result] = await tx
          .updateTable(table)
          .set({ archived_at: context.now })
          .where("deleted_at", "is", null)
          .where("archived_at", "is", null)
          .execute();
        archivedLive += result?.numUpdatedRows ?? 0n;
        const rows = await tx
          .selectFrom(table)
          .select("id")
          .where("deleted_at", "is", null)
          .execute();
        for (const row of rows) archived.add(row.id);
      }
    },
  );
  try {
    // Without a Live Row to archive, the answer could not show an archived one.
    if (archivedLive === 0n)
      return [{ entry, rule: "active query has no seeded Live Row to archive" }];
    const target = frameEntry(module, entry, { database, sources, checkOutputs: false });
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
