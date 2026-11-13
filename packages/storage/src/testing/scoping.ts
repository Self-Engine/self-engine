import { isDeepStrictEqual } from "node:util";
import { call, ORPCError, type AnyProcedure } from "@orpc/server";
import {
  createContext,
  createFrame,
  type StorageContract,
  type StorageModule,
  type RowMap,
  type StorageContext,
} from "../core/index.ts";
import { createSpaceRows, SECOND_SPACE_ID, THIRD_SPACE_ID } from "@self-engine/spaces/testing";
import { createTestContext, createTestDatabase } from "./helpers.ts";
import { tableContents } from "./table-contents.ts";
import type { ContractViolation } from "./violation.ts";
import type { Database, TablesOf } from "@self-engine/db";
import type { Seed } from "./seed.ts";

function scopedTables(rowMap: RowMap) {
  return Object.entries(rowMap)
    .filter(
      ([name, schema]) =>
        !name.startsWith("local_") &&
        ["id", "space_id", "deleted_at"].every((column) => Object.hasOwn(schema.shape, column)),
    )
    .map(([name]) => name);
}

/** Seed independent examples so the caller's example input still addresses the first Space. */
export async function seedScoping<Rows extends RowMap>(
  database: Database,
  rowMap: Rows,
  seed: Seed<Rows>,
  context: StorageContext,
) {
  const tables = scopedTables(rowMap);
  const foreign = new Set<string>();
  const deleted = new Set<string>();
  for (const [spaceId, ids, remove] of [
    [SECOND_SPACE_ID, foreign, false],
    [THIRD_SPACE_ID, deleted, true],
  ] as const) {
    await database.kysely.transaction().execute(async (transaction) => {
      // The rows seeded here refer to their Space, so it must exist before the commit (D286).
      await createSpaceRows(transaction, [{ id: spaceId }]);
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

/** Compare hidden seed rows with their absence, keeping explicit restore examples valid. */
export async function checkEntryScoping<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  seed: Seed<Rows>,
  entry: string,
  example: unknown,
  dependencies: readonly { readonly migrations: StorageModule<Contract, Rows>["migrations"] }[],
): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  for (const mode of ["deleted", "space"] as const) {
    const results = [];
    let changedHidden = false;
    for (const absent of [true, false]) {
      const database = await createTestDatabase(module, dependencies);
      try {
        const sources = createTestContext();
        const context = createContext(sources);
        const hidden = new Map<string, readonly string[]>();
        await database.kysely.transaction().execute(async (transaction) => {
          // Rows moved to another Space refer to it. Both runs hold it, so only the rows differ.
          await createSpaceRows(transaction, [{ id: SECOND_SPACE_ID }]);
          await seed(transaction.withTables<TablesOf<Rows>>(), context);
          const tx =
            transaction.withTables<
              Record<string, { id: string; space_id: string; deleted_at: string | null }>
            >();
          for (const table of scopedTables(module.rowMap)) {
            // Originally deleted rows remain available to explicit restore operations.
            const rows = await tx
              .selectFrom(table)
              .select("id")
              .$if(mode === "deleted", (query) => query.where("deleted_at", "is", null))
              .execute();
            const ids = rows.map((row) => row.id);
            hidden.set(table, ids);
            if (ids.length === 0) continue;
            if (absent) await tx.deleteFrom(table).where("id", "in", ids).execute();
            else
              await tx
                .updateTable(table)
                .set(
                  mode === "deleted" ? { deleted_at: context.now } : { space_id: SECOND_SPACE_ID },
                )
                .where("id", "in", ids)
                .execute();
          }
        });
        const before = await tableContents(database);
        const router: Record<string, AnyProcedure> = createFrame(module, {
          database,
          sources,
          checkOutputs: false,
        });
        const target = router[entry];
        if (target === undefined) throw new Error(`Missing module function: ${entry}`);
        try {
          results.push({ output: await call(target, example) });
        } catch (error) {
          if (!(error instanceof ORPCError)) throw error;
          results.push({ code: error.code, data: error.data });
        }
        if (!absent && module.entries[entry]?.kind === "operation") {
          const after = await tableContents(database);
          changedHidden = scopedRowsChanged(before, after, new Set([...hidden.values()].flat()));
        }
      } finally {
        await database.close();
      }
    }
    if (changedHidden || !isDeepStrictEqual(results[0], results[1]))
      violations.push({
        entry,
        rule:
          mode === "deleted"
            ? "entry does not treat deleted rows as absent"
            : "entry does not treat another Space's rows as absent",
      });
  }
  return violations;
}

export function scopedRowsChanged(
  before: ReadonlyMap<string, readonly string[]>,
  after: ReadonlyMap<string, readonly string[]>,
  ids: ReadonlySet<string>,
) {
  for (const [table, rows] of before) {
    const selected = (rows: readonly string[] = []) =>
      rows.filter((row) => ids.has(JSON.parse(row).id));
    if (!isDeepStrictEqual(selected(rows), selected(after.get(table)))) return true;
  }
  return false;
}
