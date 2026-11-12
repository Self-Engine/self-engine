import { createMigrationRunner, type Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";

/** A caller owns and closes this fresh, migrated database. */
export async function createTestDatabase(module: { readonly migrations: readonly Migration[] }) {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, module.migrations).run();
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

export function createTestContext(start = new Date("2026-11-12T12:00:00.000Z")) {
  return createTestSources(start);
}
