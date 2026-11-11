import path from "node:path";
import { BrowserWindow, app, net, protocol, screen } from "electron";
import { buildIdentity } from "./build-channel.ts";
import { resolveDevServer, userDataPath } from "./channel.ts";
import {
  contentSecurityPolicy,
  desktopUrl,
  isRendererUrl,
  proxyToDevServer,
  serveAsset,
  withContentSecurityPolicy,
} from "./protocol.ts";
import { titleBarOptions } from "./title-bar.ts";
import {
  MINIMUM_WIDTH,
  type WindowSnapshot,
  openWindowState,
  recordWindowState,
} from "./window-state.ts";

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

// The Window State's file; per channel, because each channel has its own data folder.
function windowStateFile(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

// The normal bounds hold the window's position and the page's size (`useContentSize`). Electron
// keeps the normal bounds of the frame while maximized or in full screen; the frame's border
// stays the same, so the page's size follows from it.
function windowSnapshot(window: BrowserWindow): WindowSnapshot {
  const normal = window.getNormalBounds();
  const frame = window.getBounds();
  const content = window.getContentBounds();
  return {
    bounds: {
      x: normal.x,
      y: normal.y,
      width: normal.width - (frame.width - content.width),
      height: normal.height - (frame.height - content.height),
    },
    maximized: window.isMaximized(),
    fullScreen: window.isFullScreen(),
  };
}

// Records every change of the window, so that a crash or a force-quit loses at most the last
// half second (D206).
function rememberWindowState(window: BrowserWindow): void {
  const recorder = recordWindowState(windowStateFile(), globalThis);
  const change = () => recorder.change(windowSnapshot(window));
  window.on("move", change);
  window.on("resize", change);
  window.on("maximize", change);
  window.on("unmaximize", change);
  window.on("enter-full-screen", change);
  window.on("leave-full-screen", change);
  window.on("close", () => recorder.close(windowSnapshot(window)));
}

async function openWindow(): Promise<void> {
  const primary = screen.getPrimaryDisplay();
  const opening = openWindowState(
    windowStateFile(),
    screen.getAllDisplays().map((display) => ({
      workArea: display.workArea,
      main: display.id === primary.id,
    })),
  );
  const window = new BrowserWindow({
    // The Window State's bounds, 1280 × 800 centered on a first start: large enough for the wide
    // Layout Step. The minimum width is the page's width, not the frame's, so that a Windows
    // frame cannot let the phone Layout Step appear.
    ...opening.bounds,
    minWidth: MINIMUM_WIDTH,
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
  window.once("ready-to-show", () => {
    if (opening.maximize) window.maximize();
    window.show();
    // On macOS full screen is a Space of its own, which a hidden window cannot enter.
    if (opening.fullScreen) window.setFullScreen(true);
    rememberWindowState(window);
  });
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
