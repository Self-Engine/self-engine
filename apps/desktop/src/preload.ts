import { contextBridge, ipcRenderer } from "electron";
import { buildIdentity } from "./build-channel.ts";
import {
  GONE_CHANNEL,
  PAGE_GONE_MESSAGE,
  PAGE_PORT_MESSAGE,
  PAGE_STOPPED_MESSAGE,
  PORT_CHANNEL,
  PORT_REQUEST_CHANNEL,
  RETRY_CHANNEL,
  STOPPED_CHANNEL,
} from "./data-process-messages.ts";

// The preload runs in the page's frame, but this app is typed for Node, without the DOM.
declare const window: {
  readonly location: { readonly origin: string };
  postMessage(message: unknown, targetOrigin: string, transfer: readonly unknown[]): void;
};

// A port cannot cross the context bridge, so it reaches the page as a window message, addressed
// to the page's own origin (apps/web/src/desktop-data.ts accepts only that). The news that the
// data process is gone or stopped travels the same way, so the page reads all three in order.
ipcRenderer.on(PORT_CHANNEL, (event) => {
  window.postMessage(PAGE_PORT_MESSAGE, window.location.origin, event.ports);
});
ipcRenderer.on(GONE_CHANNEL, () => {
  window.postMessage(PAGE_GONE_MESSAGE, window.location.origin, []);
});
ipcRenderer.on(STOPPED_CHANNEL, () => {
  window.postMessage(PAGE_STOPPED_MESSAGE, window.location.origin, []);
});

// The renderer's marker for "running in Electron", and which channel (apps/web/src/env.ts).
contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  channel: buildIdentity.channel,
  // The page asks once its listener is in place, and again after every reload.
  requestDataPort: () => ipcRenderer.send(PORT_REQUEST_CHANNEL),
  // Starts the data process again after it stopped; a fresh port follows.
  retryDataProcess: () => ipcRenderer.send(RETRY_CHANNEL),
});
