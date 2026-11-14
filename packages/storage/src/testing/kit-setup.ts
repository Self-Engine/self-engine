import type { AnyProcedure } from "@orpc/server";
import type { Migration, TablesOf } from "@self-engine/db";
import type { Transaction } from "kysely";
import {
  createContext,
  createFrame,
  type FrameOptions,
  type RowMap,
  type StorageContext,
  type StorageContract,
  type StorageModule,
} from "../core/index.ts";
import { createTestContext, createTestDatabase } from "./helpers.ts";
import type { Seed } from "./seed.ts";

/**
 * A fresh test database with the module's seed, for one check. `prepare` changes the seeded rows
 * in the same transaction. The caller closes the database.
 */
export async function createSeededDatabase<Rows extends RowMap>(
  module: { readonly migrations: readonly Migration[] },
  dependencies: readonly { readonly migrations: readonly Migration[] }[],
  seed: Seed<Rows>,
  prepare?: (transaction: Transaction<unknown>, context: StorageContext) => void | Promise<void>,
) {
  const database = await createTestDatabase(module, dependencies);
  try {
    const sources = createTestContext();
    const context = createContext(sources);
    await database.kysely.transaction().execute(async (transaction) => {
      await seed(transaction.withTables<TablesOf<Rows>>(), context);
      await prepare?.(transaction, context);
    });
    return { database, sources, context };
  } catch (error) {
    await database.close();
    throw error;
  }
}

/** The framed function of one entry, as the app calls it. */
export function frameEntry<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  entry: string,
  options: FrameOptions,
): AnyProcedure {
  const router: Record<string, AnyProcedure> = createFrame(module, options);
  const target = router[entry];
  if (target === undefined) throw new Error(`Missing module function: ${entry}`);
  return target;
}
