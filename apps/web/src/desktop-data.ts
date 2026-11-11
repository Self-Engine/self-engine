import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { CONNECTION_MARK, type DesktopBridge, readPageMessage } from "@self-engine/desktop-bridge";

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
 * The news that the data process is gone, stopped or failed arrives the same way and becomes
 * the connection's state (D190); after a restart the desktop app sends a fresh port unasked.
 */
export function connectDesktopData(
  win: DesktopDataWindow,
  bridge: Pick<DesktopBridge, "requestDataPort">,
  connection: Pick<DataConnection, "connect" | "disconnect" | "stop" | "fail">,
): void {
  win.addEventListener("message", (event) => {
    if (event.origin !== win.location.origin) return;
    const message = readPageMessage(event.data);
    switch (message?.kind) {
      case "port": {
        const [port] = event.ports;
        if (port !== undefined) connection.connect(port);
        break;
      }
      case "gone":
        connection.disconnect();
        break;
      case "stopped":
        connection.stop();
        break;
      case "failed":
        connection.fail(message.failure);
        break;
      default:
    }
  });
  bridge.requestDataPort();
}

/**
 * Marks the state the connection is in, then every change of it, as `CONNECTION_MARK`. The
 * desktop smoke test reads the marks: the first `ready` is the first answer, timed from the
 * window's start, and a later `ready` in the same document proves a reconnect without a reload.
 */
export function markConnectionStates(
  connection: Pick<DataConnection, "getState" | "subscribe">,
  mark: (name: string, options: { detail: string }) => void,
): void {
  const markState = () => mark(CONNECTION_MARK, { detail: connection.getState().status });
  markState();
  connection.subscribe(markState);
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
