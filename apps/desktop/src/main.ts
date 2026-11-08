import path from "node:path";
import { BrowserWindow, app, net, protocol } from "electron";
import { desktopDataFolder, desktopScheme } from "./channel.ts";
import {
  contentSecurityPolicy,
  desktopUrl,
  isRendererUrl,
  proxyToDevServer,
  serveAsset,
  withContentSecurityPolicy,
} from "./protocol.ts";

// Set by the dev runner (scripts/desktop-dev.ts). A packaged app never follows it.
const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL?.trim();
const devServer = devServerUrl ? new URL(devServerUrl) : undefined;
const isDevelopment = devServer !== undefined;
const scheme = desktopScheme(isDevelopment);

// Both must run before the app is ready.
app.setPath("userData", path.join(app.getPath("appData"), desktopDataFolder(isDevelopment)));
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

function registerProtocol(): void {
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
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isRendererUrl(url, scheme)) event.preventDefault();
  });
  await window.loadURL(desktopUrl(scheme));
}

async function start(): Promise<void> {
  await app.whenReady();
  registerProtocol();
  await openWindow();
}

app.on("window-all-closed", () => app.quit());

start().catch((error: unknown) => {
  console.error("Self-Engine failed to start", error);
  app.exit(1);
});
