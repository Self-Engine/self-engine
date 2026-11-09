import { Migrator } from "kysely/migration";
import type { Migration as KyselyMigration, MigrationProvider } from "kysely/migration";
import type { Database } from "./database.ts";
import type { Migration } from "./migration.ts";

export interface MigrationRunner {
  /** Whether a run would apply anything, so a backup can be taken only when one is needed. */
  hasPending(): Promise<boolean>;
  /** Runs all pending migrations as one transaction and returns their names. */
  run(): Promise<string[]>;
}

function providerOf(database: Database, migrations: readonly Migration[]): MigrationProvider {
  const entries = migrations.map(({ name, sql }): [string, KyselyMigration] => [
    name,
    { up: () => database.executeScript(sql) },
  ]);
  return { getMigrations: () => Promise.resolve(Object.fromEntries(entries)) };
}

/** A runner for the given migrations. The caller composes the list, so this knows no module. */
export function createMigrationRunner(
  database: Database,
  migrations: readonly Migration[],
): MigrationRunner {
  const seen = new Set<string>();
  for (const { name } of migrations) {
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
        throw failed
          ? new Error(`Migration ${failed.migrationName} failed`, { cause: error })
          : error;
      }
      return (results ?? []).map((result) => result.migrationName);
    },
  };
}
