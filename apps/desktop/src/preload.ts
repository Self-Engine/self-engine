import { contextBridge, ipcRenderer } from "electron";
import { buildIdentity } from "./build-channel.ts";
import { PAGE_PORT_MESSAGE, PORT_CHANNEL, PORT_REQUEST_CHANNEL } from "./data-process-messages.ts";

// The preload runs in the page's frame, but this app is typed for Node, without the DOM.
declare const window: {
  readonly location: { readonly origin: string };
  postMessage(message: unknown, targetOrigin: string, transfer: readonly unknown[]): void;
};

// A port cannot cross the context bridge, so it reaches the page as a window message, addressed
// to the page's own origin (apps/web/src/desktop-data.ts accepts only that).
ipcRenderer.on(PORT_CHANNEL, (event) => {
  window.postMessage(PAGE_PORT_MESSAGE, window.location.origin, event.ports);
});

// The renderer's marker for "running in Electron", and which channel (apps/web/src/env.ts).
contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  channel: buildIdentity.channel,
  // The page asks once its listener is in place, and again after every reload.
  requestDataPort: () => ipcRenderer.send(PORT_REQUEST_CHANNEL),
});
