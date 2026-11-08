import { contextBridge } from "electron";
import { buildIdentity } from "./build-channel.ts";

// The renderer's marker for "running in Electron", and which channel (apps/web/src/env.ts).
contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  channel: buildIdentity.channel,
});
