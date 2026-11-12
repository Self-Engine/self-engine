import {
  type DataPort,
  type DataProcessOptions,
  startDataProcess,
} from "@self-engine/data-process";
import { handoffPage, servingMessage } from "./data-process-messages.ts";

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

export interface DataProcessRuntime extends DataProcessOptions {
  readonly parentPort: ParentPort;
}

/**
 * Starts the core and serves each port the main process hands over. Only then does it tell
 * the main process that it is serving: a port that arrived earlier would have no listener.
 * A page's new port closes the one it had: after a reload nothing uses the old one.
 */
export async function runDataProcess({
  parentPort,
  ...options
}: DataProcessRuntime): Promise<void> {
  const dataProcess = await startDataProcess(options);
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
}
