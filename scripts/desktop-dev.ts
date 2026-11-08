// `pnpm dev`: the Vite dev server for the renderer, `vp pack --watch` for main and preload,
// and Electron, restarted when a bundle changes. Closing the window ends the whole run.
//
// `node_modules/.bin/vp` is a shell shim, so killing its pid leaves the real process behind
// (spike RESULTS.md). Every child therefore runs in its own process group, and stopping a
// child signals the group.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, rmSync, watch } from "node:fs";
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
    if (clock.now() >= deadline) {
      throw new Error(`dev server or bundles not ready after ${timeoutMs} ms`);
    }
    await clock.sleep(intervalMs);
  }
}

export interface SupervisorOptions {
  /** Starts a new Electron; the supervisor stops it and watches for its exit. */
  launchElectron: () => ChildProcess;
  stop: (child: ChildProcess) => Promise<void>;
  exit: (code: number) => void;
  report: (message: string) => void;
  restartDebounceMs: number;
}

export interface Supervisor {
  /** Runs the start-up; a failure stops everything started so far and exits non-zero. */
  run(start: () => Promise<void>): Promise<void>;
  /** Tracks a started dev server: its failure or exit ends the run. */
  addService(service: ChildProcess): void;
  launch(): void;
  /** Requests an Electron restart, debounced. */
  scheduleRestart(): void;
  /** Runs `cleanup` when the run ends. */
  onShutdown(cleanup: () => void): void;
  fail(error: unknown): Promise<void>;
  shutdown(exitCode: number): Promise<void>;
  isStopping(): boolean;
}

/**
 * Owns every child of a dev run, so whatever goes wrong stops all of them. Restarts run one
 * at a time: a restart that overlapped another would launch a second Electron over the one
 * the first launched, and nothing would stop that one any more.
 */
export function createSupervisor(options: SupervisorOptions): Supervisor {
  const { launchElectron, stop, exit, report, restartDebounceMs } = options;
  const services: ChildProcess[] = [];
  const cleanups: (() => void)[] = [];
  let electron: ChildProcess | undefined;
  let restartTimer: NodeJS.Timeout | undefined;
  let restartQueue: Promise<void> = Promise.resolve();
  let restarting = false;
  let stopping = false;

  const shutdown = async (exitCode: number): Promise<void> => {
    if (stopping) return;
    stopping = true;
    clearTimeout(restartTimer);
    for (const cleanup of cleanups) cleanup();
    const children = [...services, ...(electron ? [electron] : [])];
    const results = await Promise.allSettled(children.map((child) => stop(child)));
    const failures = results.filter((result) => result.status === "rejected");
    for (const failure of failures) {
      report(`pnpm dev could not stop a process: ${errorMessage(failure.reason)}`);
    }
    exit(failures.length > 0 && exitCode === 0 ? 1 : exitCode);
  };

  const fail = async (error: unknown): Promise<void> => {
    report(`pnpm dev failed: ${errorMessage(error)}`);
    await shutdown(1);
  };

  const launch = (): void => {
    if (stopping) return;
    const app = launchElectron();
    electron = app;
    app.on("error", (error) => void fail(error));
    app.once("exit", (code) => {
      if (app === electron && !restarting) void shutdown(code ?? 0);
    });
  };

  const restart = async (): Promise<void> => {
    restarting = true;
    try {
      if (electron) await stop(electron);
    } finally {
      restarting = false;
    }
    launch();
  };

  return {
    run: async (start) => {
      try {
        await start();
      } catch (error) {
        await fail(error);
      }
    },
    addService: (service) => {
      services.push(service);
      service.on("error", (error) => void fail(error));
      service.once("exit", (code) => void shutdown(code ?? 1));
    },
    launch,
    scheduleRestart: () => {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        restartQueue = restartQueue.then(restart).catch(fail);
      }, restartDebounceMs);
    },
    onShutdown: (cleanup) => {
      cleanups.push(cleanup);
    },
    fail,
    shutdown,
    isStopping: () => stopping,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const devServerUrl = `http://127.0.0.1:${DEV_PORT}/`;
  const serviceEnv = { ...process.env, PORT: String(DEV_PORT) };
  const vp = (dir: string) => join(dir, "node_modules/.bin/vp");
  const supervisor = createSupervisor({
    launchElectron: () =>
      spawnGroup(
        createRequire(join(DESKTOP_DIR, "package.json"))("electron") as string,
        electronArgs(process.env),
        DESKTOP_DIR,
        electronEnv(process.env, devServerUrl),
      ),
    stop: (child) => stopGroup(child),
    exit: (code) => process.exit(code),
    report: (message) => console.error(message),
    restartDebounceMs: RESTART_DEBOUNCE_MS,
  });

  process.once("SIGINT", () => void supervisor.shutdown(130));
  process.once("SIGTERM", () => void supervisor.shutdown(143));
  process.once("SIGHUP", () => void supervisor.shutdown(129));

  await supervisor.run(async () => {
    ensureElectron(DESKTOP_DIR);
    // A bundle left from an earlier run must not count as ready before the first build.
    rmSync(BUNDLE_DIR, { recursive: true, force: true });

    supervisor.addService(spawnGroup(vp(WEB_DIR), ["dev"], WEB_DIR, serviceEnv));
    supervisor.addService(
      spawnGroup(vp(DESKTOP_DIR), ["pack", "--watch"], DESKTOP_DIR, serviceEnv),
    );

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
    if (supervisor.isStopping()) return;
    supervisor.launch();
    const watcher = watch(BUNDLE_DIR, (_event, name) => {
      if (isBundle(name)) supervisor.scheduleRestart();
    });
    watcher.on("error", (error) => void supervisor.fail(error));
    supervisor.onShutdown(() => watcher.close());
  });
}

if (import.meta.main) await main();
