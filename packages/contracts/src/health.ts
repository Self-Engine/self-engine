import { oc } from "@orpc/contract";
import { z } from "zod";

/** The outcome of the data process's start: whether it opened the database and migrated it. */
export const healthSchema = z.object({
  state: z.literal("ready"),
  /** `select sqlite_version()`, so a report names the engine that wrote the file. */
  sqliteVersion: z.string(),
  /** The migrations this start applied, in the order they ran. */
  migrations: z.array(z.string()),
});

export type Health = z.infer<typeof healthSchema>;

/** Answers in every state of the data process, so the renderer can always ask how it is. */
export const healthContract = oc.output(healthSchema);
