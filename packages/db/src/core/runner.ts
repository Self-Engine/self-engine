import { sql } from "kysely";
import { DEFAULT_MIGRATION_TABLE, Migrator } from "kysely/migration";
import type { Migration as KyselyMigration, MigrationProvider } from "kysely/migration";
import type { Database } from "./database.ts";
import type { Migration } from "./migration.ts";
import { MigrationRunError } from "./migration-run-error.ts";

export interface MigrationRunner {
  /** Whether a run would apply anything, so a backup can be taken only when one is needed. */
  hasPending(): Promise<boolean>;
  /**
   * Runs all pending migrations as one transaction and returns their names. Rejects with a
   * `MigrationRunError` when a migration fails or the database ran one this app does not know.
   */
  run(): Promise<string[]>;
}

function providerOf(database: Database, migrations: readonly Migration[]): MigrationProvider {
  const entries = migrations.map(({ name, sql }): [string, KyselyMigration] => [
    name,
    { up: () => database.executeScript(sql) },
  ]);
  return { getMigrations: () => Promise.resolve(Object.fromEntries(entries)) };
}

/**
 * The first migration the database recorded that is not in the list. Kysely only says so in the
 * text of its error, so this reads its bookkeeping table instead of parsing that text.
 */
async function firstUnknownMigration(
  database: Database,
  migrations: readonly Migration[],
): Promise<string | undefined> {
  const known = new Set(migrations.map(({ name }) => name));
  const { rows } = await sql<{ name: string }>`
    SELECT name FROM ${sql.table(DEFAULT_MIGRATION_TABLE)} ORDER BY timestamp, name
  `.execute(database.kysely);
  return rows.find(({ name }) => !known.has(name))?.name;
}

const MIGRATION_NAME = /^[a-z][a-z0-9-]*\/\d{4}$/;

/**
 * A runner for the given migrations. The caller composes the list, so this knows no module.
 * Every migration passes through here, so this is the one check of a migration's name.
 */
export function createMigrationRunner(
  database: Database,
  migrations: readonly Migration[],
): MigrationRunner {
  const seen = new Set<string>();
  for (const { name } of migrations) {
    if (!MIGRATION_NAME.test(name)) {
      throw new Error(`Migration ${name} must be named <module>/<four digits>, like time/0003`);
    }
    if (seen.has(name)) throw new Error(`Two migrations are named ${name}`);
    seen.add(name);
  }
  const migrator = new Migrator({
    db: database.kysely,
    provider: providerOf(database, migrations),
    allowUnorderedMigrations: true,
  });
  return {
    async hasPending() {
      const known = await migrator.getMigrations();
      return known.some((migration) => migration.executedAt === undefined);
    },
    async run() {
      const { error, results } = await migrator.migrateToLatest();
      if (error !== undefined) {
        const failed = results?.find((result) => result.status === "Error");
        if (failed)
          throw new MigrationRunError("migrationFailed", failed.migrationName, { cause: error });
        const unknown = await firstUnknownMigration(database, migrations).catch(() => {
          // Bookkeeping may not exist when setup failed; preserve that original failure.
          throw error;
        });
        if (unknown !== undefined)
          throw new MigrationRunError("databaseNewer", unknown, { cause: error });
        throw error;
      }
      return (results ?? []).map((result) => result.migrationName);
    },
  };
}
