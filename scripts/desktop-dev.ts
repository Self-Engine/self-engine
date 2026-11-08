// `pnpm dev`: the Vite dev server for the renderer, `vp pack --watch` for main and preload,
// and Electron, restarted when a bundle changes. Closing the window ends the whole run.
//
// `node_modules/.bin/vp` is a shell shim, so killing its pid leaves the real process behind
// (spike RESULTS.md). Every child therefore runs in its own process group, and stopping a
// child signals the group.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, type FSWatcher, rmSync, watch } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { DESKTOP_DIR, ensureElectron } from "./ensure-electron.ts";

const WEB_DIR = resolve(import.meta.dirname, "../apps/web");
const BUNDLE_DIR = join(DESKTOP_DIR, "dist-electron");
const BUNDLES = ["main.cjs", "preload.cjs"];
const DEV_PORT = 5733;
const STOP_GRACE_MS = 1_500;
const RESTART_DEBOUNCE_MS = 150;
const READY_TIMEOUT_MS = 60_000;
const READY_INTERVAL_MS = 100;

export type Kill = (pid: number, signal: NodeJS.Signals) => void;

const killProcess: Kill = (pid, signal) => {
  process.kill(pid, signal);
};

/** Whether `name` is a bundle whose change needs an Electron restart. */
export function isBundle(name: string | null): boolean {
  return name !== null && BUNDLES.includes(name);
}

/** The environment Electron runs in. */
export function electronEnv(env: NodeJS.ProcessEnv, devServerUrl: string): NodeJS.ProcessEnv {
  const { ELECTRON_RUN_AS_NODE: _runAsNode, ...rest } = env;
  return { ...rest, VITE_DEV_SERVER_URL: devServerUrl };
}

/** Electron's arguments; a debugging port lets a test drive the running window. */
export function electronArgs(env: NodeJS.ProcessEnv): string[] {
  const port = env.SELF_ENGINE_REMOTE_DEBUGGING_PORT?.trim();
  return [...(port ? [`--remote-debugging-port=${port}`] : []), "."];
}

/** Signals the process group of `pid`; a group that is already gone is fine. */
export function killGroup(pid: number, signal: NodeJS.Signals, kill: Kill = killProcess): void {
  try {
    kill(-pid, signal);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
  }
}

/** Stops the group of `child` and resolves on exit, escalating to SIGKILL after the grace. */
export function stopGroup(
  child: ChildProcess,
  kill: Kill = killProcess,
  graceMs: number = STOP_GRACE_MS,
): Promise<void> {
  const { pid } = child;
  if (pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((done) => {
    const forced = setTimeout(() => killGroup(pid, "SIGKILL", kill), graceMs);
    child.once("exit", () => {
      clearTimeout(forced);
      done();
    });
    killGroup(pid, "SIGTERM", kill);
  });
}

/** Polls `isReady` until it holds; throws once `timeoutMs` have passed. */
export async function waitUntil(
  isReady: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
  clock: { now(): number; sleep(ms: number): Promise<void> },
): Promise<void> {
  const deadline = clock.now() + timeoutMs;
  while (!(await isReady())) {
    if (clock.now() >= deadline) throw new Error(`not ready after ${timeoutMs} ms`);
    await clock.sleep(intervalMs);
  }
}

function spawnGroup(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return spawn(command, args, { cwd, env, stdio: "inherit", detached: true });
}

async function isServing(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch (error) {
    if (error instanceof TypeError) return false; // connection refused: not up yet
    throw error;
  }
}

async function main(): Promise<void> {
  ensureElectron(DESKTOP_DIR);
  // A bundle left from an earlier run must not count as ready before the first build.
  rmSync(BUNDLE_DIR, { recursive: true, force: true });

  const devServerUrl = `http://127.0.0.1:${DEV_PORT}/`;
  const serviceEnv = { ...process.env, PORT: String(DEV_PORT) };
  const vp = (dir: string) => join(dir, "node_modules/.bin/vp");
  const services = [
    spawnGroup(vp(WEB_DIR), ["dev"], WEB_DIR, serviceEnv),
    spawnGroup(vp(DESKTOP_DIR), ["pack", "--watch"], DESKTOP_DIR, serviceEnv),
  ];

  const electronPath = createRequire(join(DESKTOP_DIR, "package.json"))("electron") as string;
  let electron: ChildProcess | undefined;
  let watcher: FSWatcher | undefined;
  let restartTimer: NodeJS.Timeout | undefined;
  let restarting = false;
  let stopping = false;

  const shutdown = async (exitCode: number): Promise<void> => {
    if (stopping) return;
    stopping = true;
    clearTimeout(restartTimer);
    watcher?.close();
    await Promise.all(
      [...services, ...(electron ? [electron] : [])].map((child) => stopGroup(child)),
    );
    process.exit(exitCode);
  };

  const launch = (): void => {
    const app = spawnGroup(
      electronPath,
      electronArgs(process.env),
      DESKTOP_DIR,
      electronEnv(process.env, devServerUrl),
    );
    electron = app;
    app.once("exit", (code) => {
      if (app === electron && !restarting) void shutdown(code ?? 0);
    });
  };

  const restart = async (): Promise<void> => {
    restarting = true;
    if (electron) await stopGroup(electron);
    restarting = false;
    if (!stopping) launch();
  };

  process.once("SIGINT", () => void shutdown(130));
  process.once("SIGTERM", () => void shutdown(143));
  process.once("SIGHUP", () => void shutdown(129));
  for (const service of services) {
    service.once("exit", (code) => void shutdown(code ?? 1));
  }

  await waitUntil(
    async () =>
      BUNDLES.every((name) => existsSync(join(BUNDLE_DIR, name))) &&
      (await isServing(devServerUrl)),
    READY_TIMEOUT_MS,
    READY_INTERVAL_MS,
    {
      now: () => performance.now(),
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    },
  );
  if (stopping) return;
  launch();
  watcher = watch(BUNDLE_DIR, (_event, name) => {
    if (!isBundle(name)) return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => void restart(), RESTART_DEBOUNCE_MS);
  });
}

if (import.meta.main) await main();
