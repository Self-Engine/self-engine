// The main process's watch over the data process (spec #29, Supervision): starts it, hands each
// page a port once it serves, restarts it after an unexpected exit and gives up after repeated
// crashes until a retry. Free of `electron`, so it can be tested in Node: main.ts passes in
// `utilityProcess.fork`, `MessageChannelMain`, the clock and the check of our own page.

import type { HealthFailure } from "@self-engine/data-protocol";
import {
  FAILED_CHANNEL,
  GONE_CHANNEL,
  PORT_CHANNEL,
  STOPPED_CHANNEL,
} from "./data-process-channels.ts";
import {
  dataProcessArgs,
  isRestartRequest,
  portHandoff,
  servingHealth,
} from "./data-process-messages.ts";

/** The part of Electron's `UtilityProcess` the supervisor uses. */
export interface DataProcessChild<Port> {
  on(event: "message", listener: (message: unknown) => void): unknown;
  on(event: "exit", listener: (code: number) => void): unknown;
  postMessage(message: unknown, transfer: Port[]): void;
  kill(): boolean;
}

/** The part of Electron's `WebFrameMain` a port and the data process's news are sent to. */
export interface PortFrame<Port> {
  readonly url: string;
  /** The frame this one is embedded in; `null` for the main frame of a window. */
  readonly parent: unknown;
  isDestroyed(): boolean;
  postMessage(channel: string, message: unknown, transfer: Port[]): void;
}

export interface SupervisorOptions<Port> {
  readonly databasePath: string;
  /** Starts the data process bundle with these arguments: `utilityProcess.fork` in the app. */
  readonly startProcess: (args: string[]) => DataProcessChild<Port>;
  /** A new pair of connected ports: `new MessageChannelMain()` in the app. */
  readonly createChannel: () => { readonly port1: Port; readonly port2: Port };
  /** Milliseconds of a clock that only moves forward: `performance.now` in the app. */
  readonly now: () => number;
  /**
   * Whether `frame` still shows our own page in the main frame of its window. A frame passed
   * this check when it asked, but may have navigated since: it is asked again before every
   * port (#141).
   */
  readonly isOwnPage: (frame: PortFrame<Port>) => boolean;
}

export interface DataProcessSupervisor<Port> {
  /**
   * Connects `frame` to the data process over a new channel, now or once it serves. The frame
   * gets a fresh port after every restart, until it is destroyed.
   */
  handPort(frame: PortFrame<Port>): void;
  /**
   * Starts a data process that stopped after repeated crashes again and counts its crashes from
   * zero. One that exited in a failure state stays down: it would fail the same way.
   */
  retry(): void;
  /** A wanted stop, such as quitting the app: ends the data process and restarts nothing. */
  stop(): void;
}

/** Unexpected exits within this window that make the supervisor stop restarting. */
const CRASH_LIMIT = 3;
const CRASH_WINDOW_MS = 60_000;

type Phase = "starting" | "serving" | "restarting" | "failed" | "stopped" | "ended";

/** Starts the data process and watches it. */
export function superviseDataProcess<Port>({
  databasePath,
  startProcess,
  createChannel,
  now,
  isOwnPage,
}: SupervisorOptions<Port>): DataProcessSupervisor<Port> {
  // Every page that asked, numbered so the data process can drop a page's earlier port.
  const pages = new Map<PortFrame<Port>, number>();
  let lastPage = 0;
  const waiting = new Set<PortFrame<Port>>();
  let crashes: number[] = [];
  let phase: Phase = "starting";
  // The failure state the data process reported; it outlives the process, which exits in it.
  let failure: HealthFailure | undefined;
  let child = start();

  function start(): DataProcessChild<Port> {
    phase = "starting";
    const started = startProcess(dataProcessArgs(databasePath));
    started.on("message", (message) => {
      if (started !== child) return;
      if (isRestartRequest(message)) return restartOnRequest();
      const health = servingHealth(message);
      if (health === undefined) return;
      // A data process in a failure state still answers `health`, so pages get their port.
      failure = health.state === "ready" ? undefined : health;
      phase = failure === undefined ? "serving" : "failed";
      for (const frame of waiting) connect(frame);
      waiting.clear();
    });
    started.on("exit", () => {
      if (started !== child || phase === "ended") return;
      // The exit it asked for: the next data process starts at once, and no crash is counted.
      if (phase === "restarting") restart(livePages());
      else crashed();
    });
    return started;
  }

  /**
   * The data process asked to be started anew, after a restore (D94). The pages hear that it is
   * gone before it is ended, so their next calls wait for the fresh port; the next one starts
   * only after the exit, because it replaces the database file the old one still has open.
   */
  function restartOnRequest(): void {
    if (phase !== "serving") return;
    phase = "restarting";
    for (const frame of livePages()) frame.postMessage(GONE_CHANNEL, null, []);
    child.kill();
  }

  function crashed(): void {
    const live = livePages();
    // A failure state comes back on every start, so restarting it would only loop. The pages
    // keep showing it; no fresh port follows.
    if (phase === "failed") {
      phase = "stopped";
      waiting.clear();
      for (const frame of live) frame.postMessage(FAILED_CHANNEL, failure, []);
      return;
    }
    const at = now();
    crashes = [...crashes.filter((time) => at - time < CRASH_WINDOW_MS), at];
    for (const frame of live) frame.postMessage(GONE_CHANNEL, null, []);
    if (crashes.length >= CRASH_LIMIT) {
      phase = "stopped";
      waiting.clear();
      for (const frame of live) frame.postMessage(STOPPED_CHANNEL, null, []);
      return;
    }
    restart(live);
  }

  function restart(frames: readonly PortFrame<Port>[]): void {
    for (const frame of frames) waiting.add(frame);
    child = start();
  }

  /**
   * The pages that still show our page, after forgetting the closed ones. One that navigated
   * away is skipped but keeps its number: if it comes back it asks again, and its new port
   * replaces the one the data process still holds for it.
   */
  function livePages(): PortFrame<Port>[] {
    for (const frame of pages.keys()) {
      if (frame.isDestroyed()) {
        pages.delete(frame);
        waiting.delete(frame);
      }
    }
    return [...pages.keys()].filter(isOwnPage);
  }

  function connect(frame: PortFrame<Port>): void {
    const page = pages.get(frame);
    if (page === undefined || frame.isDestroyed()) {
      pages.delete(frame);
      return;
    }
    // Navigated away since it asked: no port (see livePages).
    if (!isOwnPage(frame)) return;
    const { port1, port2 } = createChannel();
    frame.postMessage(PORT_CHANNEL, null, [port2]);
    child.postMessage(portHandoff(page), [port1]);
  }

  return {
    handPort(frame) {
      if (phase === "ended" || frame.isDestroyed()) return;
      if (!pages.has(frame)) pages.set(frame, ++lastPage);
      if (phase === "stopped") {
        if (failure === undefined) frame.postMessage(STOPPED_CHANNEL, null, []);
        else frame.postMessage(FAILED_CHANNEL, failure, []);
      } else if (phase === "starting" || phase === "restarting") waiting.add(frame);
      else connect(frame);
    },
    retry() {
      if (phase !== "stopped" || failure !== undefined) return;
      crashes = [];
      restart(livePages());
    },
    stop() {
      if (phase === "ended") return;
      phase = "ended";
      waiting.clear();
      child.kill();
    },
  };
}
