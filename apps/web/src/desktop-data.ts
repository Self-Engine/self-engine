import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import type { DesktopBridge } from "./env.ts";

/**
 * The `data` of the window message that carries the port to the data process.
 * PAGE_PORT_MESSAGE in apps/desktop/src/data-process-messages.ts is the source.
 */
export const PAGE_PORT_MESSAGE = "self-engine:data-port";

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
 */
export function connectDesktopData(
  win: DesktopDataWindow,
  bridge: Pick<DesktopBridge, "requestDataPort">,
  connection: Pick<DataConnection, "connect">,
): void {
  win.addEventListener("message", (event) => {
    if (event.origin !== win.location.origin || event.data !== PAGE_PORT_MESSAGE) return;
    const [port] = event.ports;
    if (port !== undefined) connection.connect(port);
  });
  bridge.requestDataPort();
}
