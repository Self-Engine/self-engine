import { createMigrationRunner, type Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import { FIRST_SPACE_ID } from "@self-engine/spaces/testing";

/** A caller owns and closes this fresh, migrated database. */
export async function createTestDatabase(
  module: { readonly migrations: readonly Migration[] },
  dependencies: readonly { readonly migrations: readonly Migration[] }[] = [],
) {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, [
      ...dependencies.flatMap((dependency) => dependency.migrations),
      ...module.migrations,
    ]).run();
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

/**
 * Fixed sources for a frame or a context in a test: a fixed clock, counted ids and the first
 * fixed Space, where the app takes the Personal Space its Data Process made sure of.
 */
export function createTestContext(start = "2026-11-12T12:00:00.000Z") {
  return { ...createTestSources(start), spaceId: FIRST_SPACE_ID };
}
