import { contextBridge } from "electron";

// The renderer's marker for "running in Electron" (apps/web/src/env.ts).
contextBridge.exposeInMainWorld("desktopBridge", { platform: process.platform });
