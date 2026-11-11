import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import type { DesktopBridge } from "./env.ts";

// The `data` of the preload's window messages; apps/desktop/src/data-process-messages.ts is
// their source.

/** Carries a port to the data process. */
export const PAGE_PORT_MESSAGE = "self-engine:data-port";

/** The data process exited unexpectedly; a fresh port follows once it is back. */
export const PAGE_GONE_MESSAGE = "self-engine:data-gone";

/** The data process kept crashing and stays down until `retryDesktopData`. */
export const PAGE_STOPPED_MESSAGE = "self-engine:data-stopped";

/** A window message, as far as the handoff reads it. */
export type PortMessage = Pick<MessageEvent, "origin" | "data" | "ports">;

/** The part of the page's window the handoff uses. */
export interface DesktopDataWindow {
  readonly location: { readonly origin: string };
  addEventListener(type: "message", listener: (event: PortMessage) => void): void;
}

/**
 * The page's one connection to the data process. It connects only in the desktop app; on the
 * web its calls wait, as nothing answers them yet (D196).
 */
export const dataConnection: DataConnection = createDataConnection();

/**
 * Listens for the port the preload posts, then asks the desktop app for one. A port arrives
 * as a window message, so only one from the page's own origin counts. A reload asks again.
 * The news that the data process is gone or stopped arrives the same way and becomes the
 * connection's state (D190); after a restart the desktop app sends a fresh port unasked.
 */
export function connectDesktopData(
  win: DesktopDataWindow,
  bridge: Pick<DesktopBridge, "requestDataPort">,
  connection: Pick<DataConnection, "connect" | "disconnect" | "stop">,
): void {
  win.addEventListener("message", (event) => {
    if (event.origin !== win.location.origin) return;
    if (event.data === PAGE_GONE_MESSAGE) connection.disconnect();
    else if (event.data === PAGE_STOPPED_MESSAGE) connection.stop();
    else if (event.data === PAGE_PORT_MESSAGE) {
      const [port] = event.ports;
      if (port !== undefined) connection.connect(port);
    }
  });
  bridge.requestDataPort();
}

/**
 * The retry of a stopped data process: the connection waits for a port again, and the desktop
 * app starts the data process with its crash count reset, then sends the port.
 */
export function retryDesktopData(
  bridge: Pick<DesktopBridge, "retryDataProcess">,
  connection: Pick<DataConnection, "disconnect">,
): void {
  connection.disconnect();
  bridge.retryDataProcess();
}
