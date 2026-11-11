import type { Database, Migration } from "@self-engine/db";
import { createRouter } from "./router.ts";
import { createPortServer, type DataPort } from "./serve.ts";
import { type BeforeMigrations, migrate } from "./startup.ts";

export interface DataProcessOptions {
  /** The opened database; the platform opens it with its own driver. */
  readonly database: Database;
  /** Every module's migrations, composed by the caller (D135). */
  readonly migrations: readonly Migration[];
  /** Called before the migrations run when some are pending, and not when none are (D138). */
  readonly beforeMigrations?: BeforeMigrations;
}

export interface DataProcess {
  /** Answers the app contract on this port. Call it again for every new port. */
  serve(port: DataPort): void;
}

/**
 * The platform-neutral core of the data process: runs the pending migrations first, so their
 * outcome is known before the first call is answered, then serves the app contract on each
 * port it receives. It knows nothing of Electron (D97).
 */
export async function startDataProcess({
  database,
  migrations,
  beforeMigrations,
}: DataProcessOptions): Promise<DataProcess> {
  const health = await migrate(database, migrations, beforeMigrations);
  return { serve: createPortServer(createRouter({ health })) };
}
