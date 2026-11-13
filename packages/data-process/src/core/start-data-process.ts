import { type AnyRouter, os } from "@orpc/server";
import type { Health, TablesChanged } from "@self-engine/data-protocol";
import type { Database } from "@self-engine/db";
import type { SpaceSources } from "@self-engine/spaces";
import { createFrame, type ErasedStorageModule, type FrameOptions } from "@self-engine/storage";
import type { DataModules } from "./modules.ts";
import type { PlatformBackups } from "./procedures/backups.ts";
import { queryTables } from "./query-tables.ts";
import { createRouter } from "./router.ts";
import { createPortServer, type DataPort } from "./serve.ts";
import { type BeforeMigrations, startUp } from "./startup.ts";
import { createTablesChangedPublisher } from "./tables-changed.ts";

export interface DataProcessOptions {
  /** The opened database; the platform opens it with its own driver. */
  readonly database: Database;
  /** The data entries to mount: the app's list, or a test's fixtures. */
  readonly modules: DataModules;
  /**
   * The clock and the id source of every call, and of the Personal Space when the first start
   * creates it. The Space of a call is not a source the app passes: the start finds it.
   */
  readonly sources: SpaceSources;
  readonly checkOutputs: boolean;
  readonly report?: FrameOptions["report"];
  /** Called before the migrations run when some are pending, and not when none are (D138). */
  readonly beforeMigrations?: BeforeMigrations;
  /**
   * The platform's Backups with the restart a restore ends with, answered as the protocol's
   * `backups` (D94). Without them every call to `backups` fails.
   */
  readonly backups?: PlatformBackups;
}

export interface DataProcess {
  /** The outcome of the start, as `health` answers it: ready, or one of the failure states. */
  readonly health: Health;
  /** Answers the app contract on this port. Call it again for every new port. */
  serve(port: DataPort): void;
  /**
   * Tells every port's `tablesChanged` stream that one committed transaction changed these
   * tables. The storage layer calls it once per commit (D193).
   */
  announceTablesChanged(tables: TablesChanged): void;
}

/**
 * A module's entries when the start ended in a failure state and found no Space for a frame:
 * `refuseUnlessReady` refuses each call before this handler could run.
 */
function unserved(module: ErasedStorageModule): AnyRouter {
  return Object.fromEntries(
    Object.keys(module.contract).map((entry) => [
      entry,
      os.handler(() => {
        throw new Error(`${module.name}.${entry} has no frame in a failure state`);
      }),
    ]),
  );
}

/**
 * The platform-neutral core of the data process: runs the pending migrations and makes sure of
 * the Personal Space first, so their outcome is known before the first call is answered, then
 * serves the app contract on each port it receives. Every module's frame gets that Space, and
 * each call's context carries it (D195, D287). It knows nothing of Electron (D97).
 */
export async function startDataProcess({
  database,
  modules,
  sources,
  checkOutputs,
  beforeMigrations,
  report,
  backups,
}: DataProcessOptions): Promise<DataProcess> {
  const { health, space } = await startUp(
    database,
    Object.values(modules).flatMap((module) => module.migrations),
    sources,
    beforeMigrations,
  );
  const tablesChanged = createTablesChangedPublisher();
  const moduleRouter = Object.fromEntries(
    Object.entries(modules).map(([name, module]) => [
      name,
      space === undefined
        ? unserved(module)
        : createFrame(module, {
            database,
            sources: { clock: sources.clock, ids: sources.ids, spaceId: space.id },
            checkOutputs,
            ...(report === undefined ? {} : { report }),
            announce: (tables) => tablesChanged.announce([...tables]),
          }),
    ]),
  );
  return {
    health,
    serve: createPortServer(
      createRouter({
        health,
        tablesChanged,
        queries: queryTables(modules),
        moduleRouter,
        backups: {
          backups,
          reportUnexpected: (entry, error) => report?.({ kind: "unexpected-error", entry, error }),
        },
      }),
    ),
    announceTablesChanged: (tables) => tablesChanged.announce(tables),
  };
}
