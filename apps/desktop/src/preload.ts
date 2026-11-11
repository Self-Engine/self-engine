import { contextBridge } from "electron";
import { buildIdentity } from "./build-channel.ts";
import { versionFromArguments } from "./channel.ts";

// The renderer's marker for "running in Electron", and which channel and version
// (apps/web/src/env.ts).
contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  channel: buildIdentity.channel,
  // Absent when the main process added none; About then says that the version is unknown.
  version: versionFromArguments(process.argv),
});
