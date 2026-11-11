import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";

/**
 * The outcome of opening the database, as the data process reports it. It knows the outcome
 * before it answers anything, because it runs the migrations first.
 */
const health = z.object({
  state: z.literal("ready"),
  /** The version of the SQLite library the data process links, such as `3.50.4`. */
  sqliteVersion: z.string(),
  /** Every migration the database has applied, by name, such as `time/0003`. */
  migrations: z.array(z.string()),
});

/** One announcement after a transaction: the tables it changed. */
const tablesChanged = z.object({ tables: z.array(z.string()) });

/**
 * The one contract between the renderer and the data process (D187). It owns only what
 * crosses modules; each module's contract is mounted here once a module has one. The import
 * direction is `contracts → module`: a module never imports this package. The renderer imports
 * it as a type only, so its schemas never load at startup there.
 */
export const appContract = {
  health: oc.output(health),
  tablesChanged: oc.output(eventIterator(tablesChanged)),
};

export type AppContract = typeof appContract;
export type Health = z.infer<typeof health>;
export type TablesChanged = z.infer<typeof tablesChanged>;
