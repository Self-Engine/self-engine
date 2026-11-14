import { createMigrationRunner, type Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import { spacesMigrations } from "@self-engine/spaces";
import { createSpaceRows, FIRST_SPACE_ID } from "@self-engine/spaces/testing";

/**
 * A caller owns and closes this fresh, migrated database. Like the start of a Data Process, it
 * runs the migration of `spaces` with the module's, and it holds the Space of the test context,
 * so a row the module writes refers to a Space the database knows (D286).
 */
export async function createTestDatabase(
  module: { readonly migrations: readonly Migration[] },
  dependencies: readonly { readonly migrations: readonly Migration[] }[] = [],
) {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, [
      ...spacesMigrations,
      ...dependencies.flatMap((dependency) => dependency.migrations),
      ...module.migrations,
    ]).run();
    await createSpaceRows(database.kysely, [{ id: FIRST_SPACE_ID }]);
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
