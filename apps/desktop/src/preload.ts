import { type DesktopBridge, type PageMessage, pageMessageData } from "@self-engine/desktop-bridge";
import type { HealthFailure } from "@self-engine/contracts";
import { contextBridge, ipcRenderer } from "electron";
import { buildIdentity } from "./build-channel.ts";
import {
  FAILED_CHANNEL,
  GONE_CHANNEL,
  PORT_CHANNEL,
  PORT_REQUEST_CHANNEL,
  RETRY_CHANNEL,
  STOPPED_CHANNEL,
} from "./data-process-channels.ts";

// The preload runs in the page's frame, but this app is typed for Node, without the DOM.
declare const window: {
  readonly location: { readonly origin: string };
  postMessage(message: unknown, targetOrigin: string, transfer: readonly unknown[]): void;
};

// A port cannot cross the context bridge, so it reaches the page as a window message, addressed
// to the page's own origin (apps/web/src/desktop-data.ts accepts only that). The news about the
// data process travels the same way, so the page reads all of it in order.
function toPage(message: PageMessage, ports: readonly unknown[] = []): void {
  window.postMessage(pageMessageData(message), window.location.origin, ports);
}
ipcRenderer.on(PORT_CHANNEL, (event) => toPage({ kind: "port" }, event.ports));
ipcRenderer.on(GONE_CHANNEL, () => toPage({ kind: "gone" }));
ipcRenderer.on(STOPPED_CHANNEL, () => toPage({ kind: "stopped" }));
// The main process sends the failure the data process reported (data-process-supervisor.ts).
ipcRenderer.on(FAILED_CHANNEL, (_event, failure: HealthFailure) =>
  toPage({ kind: "failed", failure }),
);

// The renderer's marker for "running in Electron", and which channel (apps/web/src/env.ts).
const desktopBridge: DesktopBridge = {
  platform: process.platform,
  channel: buildIdentity.channel,
  // The page asks once its listener is in place, and again after every reload.
  requestDataPort: () => ipcRenderer.send(PORT_REQUEST_CHANNEL),
  // Starts the data process again after it stopped; a fresh port follows.
  retryDataProcess: () => ipcRenderer.send(RETRY_CHANNEL),
};
contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);
