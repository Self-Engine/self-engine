import type { TablesChanged } from "@self-engine/contracts";
import type { Database, Migration } from "@self-engine/db";
import { createRouter } from "./router.ts";
import { createPortServer, type DataPort } from "./serve.ts";
import { migrate } from "./startup.ts";
import { createTablesChangedPublisher } from "./tables-changed.ts";

export interface DataProcessOptions {
  /** The opened database; the platform opens it with its own driver. */
  readonly database: Database;
  /** Every module's migrations, composed by the caller (D135). */
  readonly migrations: readonly Migration[];
}

export interface DataProcess {
  /** Answers the app contract on this port. Call it again for every new port. */
  serve(port: DataPort): void;
  /**
   * Tells every port's `tablesChanged` stream that one committed transaction changed these
   * tables. The storage layer calls it once per commit (D193).
   */
  announceTablesChanged(tables: TablesChanged): void;
}

/**
 * The platform-neutral core of the data process: runs the pending migrations first, so their
 * outcome is known before the first call is answered, then serves the app contract on each
 * port it receives. It knows nothing of Electron (D97).
 */
export async function startDataProcess({
  database,
  migrations,
}: DataProcessOptions): Promise<DataProcess> {
  const health = await migrate(database, migrations);
  const tablesChanged = createTablesChangedPublisher();
  return {
    serve: createPortServer(createRouter({ health, tablesChanged })),
    announceTablesChanged: (tables) => tablesChanged.announce(tables),
  };
}
