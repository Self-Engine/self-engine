import path from "node:path";
import { BrowserWindow, app, ipcMain } from "electron";
import { openDb, readInfo } from "@spike/db";

const VARIANT = "A (vp pack)";
const t0 = Date.now();

void app.whenReady().then(() => {
  const dbFile = path.join(app.getPath("userData"), "spike.db");
  const db = openDb(dbFile);
  const info = readInfo(db);
  console.log(`[main] db opened ${dbFile}`);
  console.log(`[main] db info ${JSON.stringify(info)}`);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeSqlite = require("node:sqlite") as typeof import("node:sqlite");
    const probe = new nodeSqlite.DatabaseSync(":memory:");
    console.log(
      `[main] node:sqlite available, sqlite ${(probe.prepare("select sqlite_version() v").get() as { v: string }).v}`,
    );
  } catch (e) {
    console.log(`[main] node:sqlite not available: ${String(e)}`);
  }
  ipcMain.handle("db:info", () => readInfo(db));

  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.webContents.on("console-message", (event) => {
    console.log(`[renderer console] ${event.message}`);
  });
  win.webContents.on("did-finish-load", () => {
    console.log(`[main] renderer loaded after ${Date.now() - t0} ms (${VARIANT})`);
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../dist-renderer/index.html"));
});

app.on("window-all-closed", () => app.quit());
