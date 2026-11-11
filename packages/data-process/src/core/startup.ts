import type { Health } from "@self-engine/contracts";
import { createMigrationRunner, type Database, type Migration } from "@self-engine/db";
import { sql } from "kysely";

/** Runs the pending migrations as one transaction (D137) and reports the outcome as health. */
export async function migrate(
  database: Database,
  migrations: readonly Migration[],
): Promise<Health> {
  const applied = await createMigrationRunner(database, migrations).run();
  const { rows } = await sql<{ version: string }>`select sqlite_version() as version`.execute(
    database.kysely,
  );
  const sqliteVersion = rows[0]?.version;
  if (sqliteVersion === undefined) throw new Error("SQLite did not report its version");
  return { state: "ready", sqliteVersion, migrations: applied };
}
