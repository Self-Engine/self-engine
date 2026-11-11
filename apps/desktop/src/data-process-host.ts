// The main process's answers to the page about the data process: a port, and a retry after it
// stopped. Free of `electron`, so it can be tested in Node: main.ts passes in `ipcMain`. The
// data process itself is watched by the supervisor (data-process-supervisor.ts).

import path from "node:path";
import { PORT_REQUEST_CHANNEL, RETRY_CHANNEL } from "./data-process-messages.ts";
import type { DataProcessSupervisor, PortFrame } from "./data-process-supervisor.ts";
import { isRendererUrl } from "./protocol.ts";

/** The database file, in the channel's data folder, which `--user-data-dir` moves. */
export function databaseFile(userData: string): string {
  return path.join(userData, "self-engine.sqlite");
}

/** A request as `ipcMain` delivers it: the part of `IpcMainEvent` the host checks. */
export interface PageRequest<Port> {
  readonly senderFrame: PortFrame<Port> | null;
  readonly sender: { readonly mainFrame: PortFrame<Port> };
}

/** The part of `ipcMain` that receives the page's requests. */
export interface PageRequests<Port> {
  on(channel: string, listener: (request: PageRequest<Port>) => void): unknown;
}

/**
 * Answers the port requests and retries of our page; a request from anywhere else is ignored.
 */
export function serveDataProcessRequests<Port>(
  ipc: PageRequests<Port>,
  supervisor: Pick<DataProcessSupervisor<Port>, "handPort" | "retry">,
  scheme: string,
): void {
  // Our own page, and only in the main frame of its window.
  const ownPage = ({ senderFrame, sender }: PageRequest<Port>): PortFrame<Port> | undefined =>
    senderFrame !== null &&
    senderFrame === sender.mainFrame &&
    isRendererUrl(senderFrame.url, scheme)
      ? senderFrame
      : undefined;
  ipc.on(PORT_REQUEST_CHANNEL, (request) => {
    const frame = ownPage(request);
    if (frame !== undefined) supervisor.handPort(frame);
  });
  ipc.on(RETRY_CHANNEL, (request) => {
    if (ownPage(request) !== undefined) supervisor.retry();
  });
}
