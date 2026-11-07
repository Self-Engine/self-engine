import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("spike", {
  variant: "A (vp pack)",
  getDbInfo: () => ipcRenderer.invoke("db:info"),
});
