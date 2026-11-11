// The main process's side of the data process: starts it, and hands each page a port to it.
// Free of `electron`, so it can be tested in Node: main.ts passes in `utilityProcess.fork`,
// `MessageChannelMain` and `ipcMain`. Restarting it after a crash is the supervisor's (#143).

import path from "node:path";
import {
  PORT_CHANNEL,
  PORT_HANDOFF,
  PORT_REQUEST_CHANNEL,
  SERVING,
  dataProcessArgs,
} from "./data-process-messages.ts";
import { isRendererUrl } from "./protocol.ts";

/** The part of Electron's `UtilityProcess` the host uses. */
export interface DataProcessChild<Port> {
  on(event: "message", listener: (message: unknown) => void): unknown;
  postMessage(message: unknown, transfer: Port[]): void;
}

/** The part of Electron's `WebFrameMain` a port is handed to. */
export interface PortFrame<Port> {
  readonly url: string;
  isDestroyed(): boolean;
  postMessage(channel: string, message: unknown, transfer: Port[]): void;
}

export interface DataProcessHostOptions<Port> {
  readonly databasePath: string;
  /** Starts the data process bundle with these arguments: `utilityProcess.fork` in the app. */
  readonly startProcess: (args: string[]) => DataProcessChild<Port>;
  /** A new pair of connected ports: `new MessageChannelMain()` in the app. */
  readonly createChannel: () => { readonly port1: Port; readonly port2: Port };
}

export interface DataProcessHost<Port> {
  /**
   * Once the data process is serving, connects `frame` to it over a new channel: one end goes
   * to the data process, the other to the frame. A frame that is gone by then gets nothing.
   */
  handPort(frame: PortFrame<Port>): Promise<void>;
}

/** The database file, in the channel's data folder, which `--user-data-dir` moves. */
export function databaseFile(userData: string): string {
  return path.join(userData, "self-engine.sqlite");
}

/** Starts the data process; it starts once, its supervision comes with #143. */
export function startDataProcessHost<Port>({
  databasePath,
  startProcess,
  createChannel,
}: DataProcessHostOptions<Port>): DataProcessHost<Port> {
  const child = startProcess(dataProcessArgs(databasePath));
  const serving = new Promise<void>((resolve) => {
    child.on("message", (message) => {
      if (message === SERVING) resolve();
    });
  });
  return {
    async handPort(frame) {
      await serving;
      if (frame.isDestroyed()) return;
      const { port1, port2 } = createChannel();
      frame.postMessage(PORT_CHANNEL, null, [port2]);
      child.postMessage(PORT_HANDOFF, [port1]);
    },
  };
}

/** A port request as `ipcMain` delivers it: the part of `IpcMainEvent` the host checks. */
export interface PortRequest<Port> {
  readonly senderFrame: PortFrame<Port> | null;
  readonly sender: { readonly mainFrame: PortFrame<Port> };
}

/** The part of `ipcMain` that receives port requests. */
export interface PortRequests<Port> {
  on(channel: string, listener: (request: PortRequest<Port>) => void): unknown;
}

/** Answers every port request of our page; a request from anywhere else gets no port. */
export function servePortRequests<Port>(
  ipc: PortRequests<Port>,
  host: DataProcessHost<Port>,
  scheme: string,
): void {
  ipc.on(PORT_REQUEST_CHANNEL, (request) => {
    const frame = request.senderFrame;
    // Our own page, and only in the main frame of its window.
    const isOwnPage =
      frame !== null && frame === request.sender.mainFrame && isRendererUrl(frame.url, scheme);
    if (isOwnPage) void host.handPort(frame);
  });
}
