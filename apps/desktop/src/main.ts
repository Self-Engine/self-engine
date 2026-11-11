import path from "node:path";
import {
  BrowserWindow,
  MessageChannelMain,
  app,
  ipcMain,
  net,
  protocol,
  utilityProcess,
} from "electron";
import { buildIdentity } from "./build-channel.ts";
import { resolveDevServer, userDataPath } from "./channel.ts";
import { databaseFile, isOwnPage, serveDataProcessRequests } from "./data-process-host.ts";
import { superviseDataProcess } from "./data-process-supervisor.ts";
import {
  contentSecurityPolicy,
  desktopUrl,
  isRendererUrl,
  proxyToDevServer,
  serveAsset,
  withContentSecurityPolicy,
} from "./protocol.ts";
import { titleBarOptions } from "./title-bar.ts";

const { channel, productName, dataFolder, icon, scheme } = buildIdentity;

// All of this must run before the app is ready. The name comes first: Electron derives the
// Keychain item of `safeStorage` from it, and the packaged metadata does not cover `electron .`.
function prepareBeforeReady(): void {
  app.setName(productName);
  app.setPath(
    "userData",
    userDataPath(
      app.getPath("appData"),
      dataFolder,
      app.commandLine.getSwitchValue("user-data-dir"),
    ),
  );
  protocol.registerSchemesAsPrivileged([
    {
      scheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function registerProtocol(devServer: URL | undefined): void {
  const policy = contentSecurityPolicy(devServer);
  const assetDirectory = path.join(app.getAppPath(), "dist-renderer");
  protocol.handle(scheme, async (request) => {
    const response = devServer
      ? await proxyToDevServer(request, devServer, (url, init) => net.fetch(url, init))
      : await serveAsset(request, assetDirectory);
    return withContentSecurityPolicy(response, policy);
  });
}

// Starts beside the window, so the database opens while the page loads. The page asks for its
// port, and gets it once the data process is serving; after a crash it gets a fresh one.
function startDataProcess(): void {
  const supervisor = superviseDataProcess({
    databasePath: databaseFile(app.getPath("userData")),
    startProcess: (args) =>
      utilityProcess.fork(path.join(__dirname, "data-process.cjs"), args, {
        serviceName: `${productName} Data`,
      }),
    createChannel: () => new MessageChannelMain(),
    now: () => performance.now(),
    isOwnPage: (frame) => isOwnPage(frame, scheme),
  });
  serveDataProcessRequests(ipcMain, supervisor, scheme);
  // Quitting ends the data process on purpose: no crash, no restart.
  app.on("will-quit", () => supervisor.stop());
}

async function openWindow(): Promise<void> {
  const window = new BrowserWindow({
    // Large enough for the wide Layout Step. The minimum width is the page's width, not the
    // frame's, so that a Windows frame cannot let the phone Layout Step appear.
    width: 1280,
    height: 800,
    minWidth: 576,
    useContentSize: true,
    ...titleBarOptions(process.platform),
    // The native window is white until the page paints, which the Start Cache cannot reach.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isRendererUrl(url, scheme)) event.preventDefault();
  });
  await window.loadURL(desktopUrl(scheme));
}

async function start(): Promise<void> {
  // Set by the dev runner (scripts/desktop-dev.ts).
  const devServer = resolveDevServer(channel, process.env.VITE_DEV_SERVER_URL);
  await app.whenReady();
  // `electron .` runs under Electron's own bundle, so the Dock needs telling.
  if (channel === "dev") app.dock?.setIcon(path.join(app.getAppPath(), icon));
  registerProtocol(devServer);
  startDataProcess();
  await openWindow();
}

function failStart(error: unknown): void {
  console.error("Self-Engine failed to start", error);
  app.exit(1);
}

app.on("window-all-closed", () => app.quit());

// An uncaught throw here would only raise Electron's error dialog and leave the app running.
// Chromium reads `--user-data-dir` before this code runs and creates the folder if it is
// missing, but opens nothing in it, so refusing here still comes before any write.
try {
  prepareBeforeReady();
  start().catch(failStart);
} catch (error) {
  failStart(error);
}
