import type { Health, HealthFailure } from "@self-engine/data-protocol";
import {
  createMigrationRunner,
  type Database,
  type Migration,
  MigrationRunError,
} from "@self-engine/db";
import {
  ensurePersonalSpace,
  spacesMigrations,
  type Space,
  type SpaceSources,
} from "@self-engine/spaces";
import { sql } from "kysely";

/** Runs before the pending migrations, only when some are pending: the backup's place (D94). */
export type BeforeMigrations = () => Promise<void> | void;

/**
 * Runs the pending migrations as one transaction (D137) and reports the outcome as health. A
 * migration that fails or a database newer than this app becomes a failure state, not a throw,
 * so the data process stays up to say why. A throw of `beforeMigrations` is not caught: no
 * migration runs without it.
 */
async function migrate(
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
    return { state: error.reason, migration: error.migration };
  }
  const { rows } = await sql<{ version: string }>`select sqlite_version() as version`.execute(
    database.kysely,
  );
  const sqliteVersion = rows[0]?.version;
  if (sqliteVersion === undefined) throw new Error("SQLite did not report its version");
  return { state: "ready", sqliteVersion, migrations: applied };
}

/**
 * The outcome of a start: a ready database with its Personal Space, or a failure state without
 * one.
 */
export type Startup =
  | { readonly health: Exclude<Health, HealthFailure>; readonly space: Space }
  | { readonly health: HealthFailure; readonly space?: undefined };

/**
 * Runs the migration of `spaces` with the mounted modules' (D287), then, only when they left the
 * database ready, makes sure the Personal Space exists, in a transaction of its own (D288). A
 * failure state creates no Space. A database whose Personal Space is broken, two of them or a
 * deleted one, makes the start throw like any unexpected failure: nothing is picked.
 */
export async function startUp(
  database: Database,
  migrations: readonly Migration[],
  sources: SpaceSources,
  beforeMigrations?: BeforeMigrations,
): Promise<Startup> {
  const health = await migrate(database, [...spacesMigrations, ...migrations], beforeMigrations);
  if (health.state !== "ready") return { health };
  return { health, space: await ensurePersonalSpace(database, sources) };
}
