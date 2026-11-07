import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("spike", {
  variant: "B (electron-vite)",
  getDbInfo: () => ipcRenderer.invoke("db:info"),
});
