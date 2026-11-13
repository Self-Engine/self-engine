import path from "node:path";
import {
  applyStagedRestore,
  type Backups,
  createBackups,
  type DailyBackupOptions,
  keepDailyBackups,
} from "@self-engine/backup";
import {
  type DataPort,
  type DataProcessOptions,
  startDataProcess,
} from "@self-engine/data-process";
import type { Database } from "@self-engine/db";
import type { Clock } from "@self-engine/time";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { handoffPage, restartMessage, servingMessage } from "./data-process-messages.ts";

/** A message from the main process, as Electron's `process.parentPort` delivers it. */
export interface ParentMessage {
  readonly data: unknown;
  readonly ports: readonly HandedPort[];
}

/** A port the main process hands over: Electron's `MessagePortMain`, or Node's in tests. */
export type HandedPort = DataPort & { close(): void };

/** The part of Electron's `process.parentPort` the data process uses. */
export interface ParentPort {
  on(event: "message", listener: (message: ParentMessage) => void): unknown;
  postMessage(message: unknown): void;
}

/** The folder of the Backups: beside the database, in the channel's data folder (D94). */
export function backupFolder(databasePath: string): string {
  return path.join(path.dirname(databasePath), "backups");
}

export interface DataFiles {
  readonly database: Database;
  readonly backups: Backups;
}

/**
 * Opens the database file with its Backups. A restore that the last data process staged is put
 * in the file's place first, while nothing has it open (D94).
 */
export function openDataFiles(databasePath: string, clock: Clock): DataFiles {
  applyStagedRestore(databasePath);
  const database = openDatabase(databasePath);
  return {
    database,
    backups: createBackups({
      database,
      databasePath,
      directory: backupFolder(databasePath),
      clock,
    }),
  };
}

export interface DataProcessRuntime extends Omit<
  DataProcessOptions,
  "backups" | "beforeMigrations"
> {
  readonly parentPort: ParentPort;
  /** The Backups of `database`, as `openDataFiles` returns both. */
  readonly backups: Backups;
  /** The timer of the daily Backup; a test passes its own. */
  readonly timer?: DailyBackupOptions["timer"];
}

/**
 * Starts the core and serves each port the main process hands over. Only then does it tell
 * the main process that it is serving: a port that arrived earlier would have no listener.
 * A page's new port closes the one it had: after a reload nothing uses the old one.
 *
 * The Backups hang on the same start (D94): one is taken before pending migrations run, the
 * daily one once the process serves, so it delays no answer, and a restore ends with the request
 * to the main process to start this process anew.
 */
export async function runDataProcess({
  parentPort,
  backups,
  timer,
  ...options
}: DataProcessRuntime): Promise<void> {
  const dataProcess = await startDataProcess({
    ...options,
    backups: { service: backups, restart: () => parentPort.postMessage(restartMessage()) },
    async beforeMigrations() {
      await backups.backUpBeforeMigrations();
    },
  });
  const pagePorts = new Map<number, HandedPort>();
  parentPort.on("message", ({ data, ports }) => {
    const page = handoffPage(data);
    const [port] = ports;
    if (page === undefined || port === undefined) return;
    pagePorts.get(page)?.close();
    pagePorts.set(page, port);
    dataProcess.serve(port);
  });
  parentPort.postMessage(servingMessage(dataProcess.health));
  // A database whose migrations failed or that a newer app wrote is left exactly as it is.
  if (dataProcess.health.state !== "ready") return;
  keepDailyBackups(backups, {
    ...(timer === undefined ? {} : { timer }),
    onError: (error) =>
      options.report?.({ kind: "unexpected-error", entry: "backups.daily", error }),
  });
}
