import path from "node:path";
import { BrowserWindow, app, net, protocol } from "electron";
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

async function openWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1100,
    height: 750,
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
