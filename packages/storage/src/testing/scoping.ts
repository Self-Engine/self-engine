import type { Database, TablesOf } from "@self-engine/db";
import { spaceIdSchema, type RowMap, type StorageContext } from "../core/index.ts";
import type { Seed } from "./seed.ts";

/** Seed independent examples so the caller's example input still addresses the first Space. */
export async function seedScoping<Rows extends RowMap>(
  database: Database,
  rowMap: Rows,
  seed: Seed<Rows>,
  context: StorageContext,
) {
  const tables = Object.entries(rowMap)
    .filter(
      ([name, schema]) =>
        !name.startsWith("local_") &&
        ["id", "space_id", "deleted_at"].every((column) => Object.hasOwn(schema.shape, column)),
    )
    .map(([name]) => name);
  const foreign = new Set<string>();
  const deleted = new Set<string>();
  for (const [space, ids, remove] of [
    ["00000000-0000-7000-8000-000000000002", foreign, false],
    ["00000000-0000-7000-8000-000000000003", deleted, true],
  ] as const) {
    const spaceId = spaceIdSchema.parse(space);
    await database.kysely.transaction().execute(async (transaction) => {
      await seed(transaction.withTables<TablesOf<Rows>>(), { ...context, spaceId });
      const tx =
        transaction.withTables<
          Record<string, { id: string; space_id: string; deleted_at: string | null }>
        >();
      for (const table of tables) {
        const rows = await tx
          .selectFrom(table)
          .select("id")
          .where("space_id", "=", spaceId)
          .execute();
        for (const row of rows) ids.add(row.id);
        if (remove)
          await tx
            .updateTable(table)
            .set({ deleted_at: context.now, space_id: context.spaceId })
            .where("space_id", "=", spaceId)
            .execute();
      }
    });
  }
  return { foreign, deleted };
}

export function returnsSeededRow(output: unknown, ids: ReadonlySet<string>): boolean {
  if (Array.isArray(output)) return output.some((value: unknown) => returnsSeededRow(value, ids));
  if (typeof output !== "object" || output === null) return false;
  if ("id" in output && typeof output.id === "string" && ids.has(output.id)) return true;
  return Object.values(output).some((value: unknown) => returnsSeededRow(value, ids));
}
