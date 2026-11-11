import type { Database, Migration } from "@self-engine/db";
import { type DataPort, startDataProcess } from "@self-engine/data-process";
import { PORT_HANDOFF, SERVING } from "./data-process-messages.ts";

/** A message from the main process, as Electron's `process.parentPort` delivers it. */
export interface ParentMessage {
  readonly data: unknown;
  readonly ports: readonly DataPort[];
}

/** The part of Electron's `process.parentPort` the data process uses. */
export interface ParentPort {
  on(event: "message", listener: (message: ParentMessage) => void): unknown;
  postMessage(message: unknown): void;
}

export interface DataProcessRuntime {
  readonly parentPort: ParentPort;
  /** The opened database; data-process.ts opens the file the main process named. */
  readonly database: Database;
  /** Every module's migrations, composed by the app (D135). */
  readonly migrations: readonly Migration[];
}

/**
 * Starts the core and serves each port the main process hands over. Only then does it tell
 * the main process that it is serving: a port that arrived earlier would have no listener.
 */
export async function runDataProcess({
  parentPort,
  database,
  migrations,
}: DataProcessRuntime): Promise<void> {
  const dataProcess = await startDataProcess({ database, migrations });
  parentPort.on("message", ({ data, ports }) => {
    if (data !== PORT_HANDOFF) return;
    for (const port of ports) dataProcess.serve(port);
  });
  parentPort.postMessage(SERVING);
}
