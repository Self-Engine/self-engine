import type { Health } from "@self-engine/contracts";
import {
  createMigrationRunner,
  type Database,
  type Migration,
  MigrationRunError,
} from "@self-engine/db";
import { sql } from "kysely";

/** Runs before the pending migrations, only when some are pending: the backup's place (D94). */
export type BeforeMigrations = () => Promise<void> | void;

/**
 * Runs the pending migrations as one transaction (D137) and reports the outcome as health. A
 * migration that fails or a database newer than this app becomes a failure state, not a throw,
 * so the data process stays up to say why. A throw of `beforeMigrations` is not caught: no
 * migration runs without it.
 */
export async function migrate(
  database: Database,
  migrations: readonly Migration[],
  beforeMigrations?: BeforeMigrations,
): Promise<Health> {
  const runner = createMigrationRunner(database, migrations);
  if (beforeMigrations !== undefined && (await runner.hasPending())) await beforeMigrations();
  let applied: string[];
  try {
    applied = await runner.run();
  } catch (error) {
    if (!(error instanceof MigrationRunError)) throw error;
    const state = error.reason === "failed" ? "migrationFailed" : "databaseNewer";
    return { state, migration: error.migration };
  }
  const { rows } = await sql<{ version: string }>`select sqlite_version() as version`.execute(
    database.kysely,
  );
  const sqliteVersion = rows[0]?.version;
  if (sqliteVersion === undefined) throw new Error("SQLite did not report its version");
  return { state: "ready", sqliteVersion, migrations: applied };
}
