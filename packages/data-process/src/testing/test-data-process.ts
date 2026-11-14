import { MessageChannel, type MessagePort } from "node:worker_threads";
import type { TablesChanged } from "@self-engine/data-protocol";
import type { Database, Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import type { SpaceSources } from "@self-engine/spaces";
import {
  type BeforeMigrations,
  type DataModules,
  type DataProcessOptions,
  startDataProcess,
} from "../core/index.ts";

export interface TestDataProcessOptions {
  readonly modules?: DataModules;
  /** The clock and ids of every call and of the Personal Space; the start finds the Space. */
  readonly sources?: SpaceSources;
  readonly checkOutputs?: boolean;
  readonly report?: DataProcessOptions["report"];
  /** Migration-only fixture for startup tests; module call tests supply modules instead. */
  readonly migrations?: readonly Migration[];
  /**
   * The database to start on, for a test that prepares it first (e.g. with migrations an older
   * app does not know). Default: a fresh in-memory database. `close()` closes it either way.
   */
  readonly database?: Database;
  /** Passed to the core: called before the migrations run when some are pending. */
  readonly beforeMigrations?: BeforeMigrations;
  /** Passed to the core: the Backups it answers as `backups`, with the restart after a restore. */
  readonly backups?: DataProcessOptions["backups"];
}

export interface TestDataProcess {
  /** The database the core serves, for a test that checks what a call left behind. */
  readonly database: Database;
  /**
   * A new `MessageChannel` whose one end the core serves; returns the other end for a client,
   * like the main process hands a port to a window.
   */
  openPort(): MessagePort;
  /** Announces a commit that changed these tables, as the storage layer will (D193). */
  announceTablesChanged(tables: TablesChanged): void;
  /** Closes every port this opened, then the database. */
  close(): Promise<void>;
}

/**
 * The real core of the data process over a real SQLite database, reached through Node's
 * `MessageChannel` instead of Electron: the main seam of the contract layer (spec #29).
 */
export async function startTestDataProcess(
  options: TestDataProcessOptions = {},
): Promise<TestDataProcess> {
  const database = options.database ?? openDatabase(":memory:");
  let core;
  try {
    core = await startDataProcess({
      database,
      modules: options.modules ?? {
        fixture: {
          name: "fixture",
          migrations: options.migrations ?? [],
          contract: {},
          rowMap: {},
          entries: {},
        },
      },
      sources: options.sources ?? createTestSources("2026-01-01T00:00:00.000Z"),
      checkOutputs: options.checkOutputs ?? true,
      ...(options.report === undefined ? {} : { report: options.report }),
      ...(options.beforeMigrations && { beforeMigrations: options.beforeMigrations }),
      ...(options.backups && { backups: options.backups }),
    });
  } catch (error) {
    if (options.database === undefined) await database.close();
    throw error;
  }
  const ports: MessagePort[] = [];
  return {
    database,
    openPort() {
      const { port1, port2 } = new MessageChannel();
      ports.push(port1, port2);
      core.serve(port1);
      return port2;
    },
    announceTablesChanged: (tables) => core.announceTablesChanged(tables),
    async close() {
      for (const port of ports) port.close();
      await database.close();
    },
  };
}
