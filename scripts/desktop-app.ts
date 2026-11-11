// Starts the desktop app under Playwright with a throwaway data folder, and always cleans up.
// The smoke stage of `pnpm verify` (desktop-smoke.ts) uses it on the built app; the packaged
// smoke test (#146) and the `verify-desktop` skill (#25) can point it at any executable.

import { createReadStream, mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { _electron, type ElectronApplication } from "playwright";

export const DESKTOP_DIR = resolve(import.meta.dirname, "../apps/desktop");
export const RENDERER_DIR = resolve(import.meta.dirname, "../apps/web/dist");

/** What to start: an Electron binary with the app's folder, or a packaged app's executable. */
export interface DesktopLaunch {
  readonly executablePath: string;
  readonly args: readonly string[];
  /** Added to this process's environment. */
  readonly env: Readonly<Record<string, string>>;
}

/** What `withDesktopApp` needs of a started app. */
export interface DesktopApp {
  close(): Promise<void>;
}

export interface StartOptions {
  readonly executablePath: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
}

/**
 * Starts `launch` with a new temporary data folder (`--user-data-dir`), so no run touches a real
 * profile, and hands the app to `use`. Afterwards, also when `use` throws, the app is closed and
 * the folder removed. `start` is `launchElectron` outside tests.
 */
export async function withDesktopApp<App extends DesktopApp, T>(
  launch: DesktopLaunch,
  use: (app: App, profile: string) => Promise<T>,
  start: (options: StartOptions) => Promise<App>,
): Promise<T> {
  const profile = mkdtempSync(join(realpathSync(tmpdir()), "self-engine-desktop-"));
  try {
    const app = await start({
      executablePath: launch.executablePath,
      args: [...launch.args, `--user-data-dir=${profile}`],
      env: { ...process.env, ...launch.env },
    });
    try {
      return await use(app, profile);
    } finally {
      await app.close();
    }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

const CLOSE_TIMEOUT_MS = 10_000;

/** Starts the app with Playwright. Closing kills it if it does not quit in time. */
export async function launchElectron(options: StartOptions): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(options.env)) {
    if (value !== undefined) env[name] = value;
  }
  const app = await _electron.launch({
    executablePath: options.executablePath,
    args: [...options.args],
    env,
  });
  const close = app.close.bind(app);
  app.close = async () => {
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<"timeout">((settle) => {
      timer = setTimeout(() => settle("timeout"), CLOSE_TIMEOUT_MS);
    });
    const result = await Promise.race([close(), timedOut]);
    clearTimeout(timer);
    if (result === "timeout") app.process().kill("SIGKILL");
  };
  return app;
}

/** The Electron binary of the `electron` package that `desktopDir` depends on. */
export function electronExecutable(desktopDir: string): string {
  // Not named `require`: the boundary check would read the call as an import of this script.
  const load = createRequire(join(desktopDir, "package.json"));
  const path: unknown = load("electron");
  if (typeof path !== "string") throw new Error("The electron package names no binary");
  return path;
}

/**
 * The built, unpackaged app: `vp pack`'s dev bundle, started by Electron. A dev bundle has no
 * renderer of its own and loads it from `rendererUrl` (apps/desktop/src/channel.ts), which
 * `serveRenderer` provides from the web build.
 */
export function builtDesktopApp(
  desktopDir: string,
  rendererUrl: string,
  electronPath: (desktopDir: string) => string = electronExecutable,
): DesktopLaunch {
  return {
    executablePath: electronPath(desktopDir),
    args: [desktopDir],
    env: { VITE_DEV_SERVER_URL: rendererUrl },
  };
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

/**
 * The file of the web build at `pathname`: a built file, or the page itself for a path without
 * an extension. Undefined for a missing asset and for a path that leaves `root`.
 */
export function rendererFile(root: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    if (error instanceof URIError) return undefined;
    throw error;
  }
  const candidate = resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) return undefined;
  if (isFile(candidate)) return candidate;
  return extname(candidate) === "" ? join(root, "index.html") : undefined;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export interface RendererServer {
  readonly url: string;
  close(): Promise<void>;
}

/** Serves the web build at `root` on a free loopback port, for a dev bundle to load. */
export async function serveRenderer(root: string): Promise<RendererServer> {
  const server = createServer((request, response) => {
    const file = rendererFile(root, new URL(request.url ?? "/", "http://renderer").pathname);
    if (file === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((settle) => server.listen(0, "127.0.0.1", settle));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((settle) => {
        server.closeAllConnections();
        server.close(() => settle());
      }),
  };
}
