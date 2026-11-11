/**
 * Why a migration run stopped: `failed` when a migration of this app threw (the run rolled back,
 * D137), `unknown` when the database ran a migration this app does not know, so it was written
 * by a newer app (D138).
 */
export type MigrationRunFailure = "failed" | "unknown";

/** A migration run that stopped, naming the migration, so the app can say which one. */
export class MigrationRunError extends Error {
  readonly reason: MigrationRunFailure;
  readonly migration: string;

  constructor(reason: MigrationRunFailure, migration: string, options?: ErrorOptions) {
    super(
      reason === "failed"
        ? `Migration ${migration} failed`
        : `The database ran migration ${migration}, which this app does not know`,
      options,
    );
    this.name = "MigrationRunError";
    this.reason = reason;
    this.migration = migration;
  }
}
