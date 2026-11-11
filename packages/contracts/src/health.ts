import { oc } from "@orpc/contract";
import { z } from "zod";

/** The data process opened the database and migrated it; every procedure answers. */
const readySchema = z.object({
  state: z.literal("ready"),
  /** `select sqlite_version()`, so a report names the engine that wrote the file. */
  sqliteVersion: z.string(),
  /** The migrations this start applied, in the order they ran. */
  migrations: z.array(z.string()),
});

/** A migration of this app failed; its run rolled back, so the database is unchanged. */
const migrationFailedSchema = z.object({
  state: z.literal("migrationFailed"),
  /** The migration that failed, like `time/0003`. */
  migration: z.string(),
});

/** The database ran a migration this app does not know: a newer app wrote it (D138). */
const databaseNewerSchema = z.object({
  state: z.literal("databaseNewer"),
  /** The first migration the database ran that this app does not know. */
  migration: z.string(),
});

/**
 * The outcome of the data process's start. In both failure states the data process answers only
 * `health` and refuses every other procedure.
 */
export const healthSchema = z.discriminatedUnion("state", [
  readySchema,
  migrationFailedSchema,
  databaseNewerSchema,
]);

export type Health = z.infer<typeof healthSchema>;

/** One of the two failure states: the data process answers only `health` and says which migration. */
export type HealthFailure = Exclude<Health, { state: "ready" }>;

/** Answers in every state of the data process, so the renderer can always ask how it is. */
export const healthContract = oc.output(healthSchema);
