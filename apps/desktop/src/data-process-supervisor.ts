// The main process's watch over the data process (spec #29, Supervision): starts it, hands each
// page a port once it serves, restarts it after an unexpected exit and gives up after repeated
// crashes until a retry. Free of `electron`, so it can be tested in Node: main.ts passes in
// `utilityProcess.fork`, `MessageChannelMain` and the clock.

import {
  GONE_CHANNEL,
  PORT_CHANNEL,
  STOPPED_CHANNEL,
  dataProcessArgs,
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
}

export interface DataProcessSupervisor<Port> {
  /**
   * Connects `frame` to the data process over a new channel, now or once it serves. The frame
   * gets a fresh port after every restart, until it is destroyed.
   */
  handPort(frame: PortFrame<Port>): void;
  /** Starts a stopped data process again and counts its crashes from zero. */
  retry(): void;
  /** A wanted stop, such as quitting the app: ends the data process and restarts nothing. */
  stop(): void;
}

/** Unexpected exits within this window that make the supervisor stop restarting. */
const CRASH_LIMIT = 3;
const CRASH_WINDOW_MS = 60_000;

type Phase = "starting" | "serving" | "failed" | "stopped" | "ended";

/** Starts the data process and watches it. */
export function superviseDataProcess<Port>({
  databasePath,
  startProcess,
  createChannel,
  now,
}: SupervisorOptions<Port>): DataProcessSupervisor<Port> {
  // Every page that asked, numbered so the data process can drop a page's earlier port.
  const pages = new Map<PortFrame<Port>, number>();
  let lastPage = 0;
  const waiting = new Set<PortFrame<Port>>();
  let crashes: number[] = [];
  let phase: Phase = "starting";
  let child = start();

  function start(): DataProcessChild<Port> {
    phase = "starting";
    const started = startProcess(dataProcessArgs(databasePath));
    started.on("message", (message) => {
      const health = servingHealth(message);
      if (started !== child || health === undefined) return;
      // A data process in a failure state still answers `health`, so pages get their port.
      phase = health === "ready" ? "serving" : "failed";
      for (const frame of waiting) connect(frame);
      waiting.clear();
    });
    started.on("exit", () => {
      if (started === child && phase !== "ended") crashed();
    });
    return started;
  }

  function crashed(): void {
    const at = now();
    crashes = [...crashes.filter((time) => at - time < CRASH_WINDOW_MS), at];
    const livePages = forgetDestroyed();
    for (const frame of livePages) frame.postMessage(GONE_CHANNEL, null, []);
    // A failure state comes back on every start, so restarting it would only loop.
    if (phase === "failed" || crashes.length >= CRASH_LIMIT) {
      phase = "stopped";
      waiting.clear();
      for (const frame of livePages) frame.postMessage(STOPPED_CHANNEL, null, []);
      return;
    }
    restart(livePages);
  }

  function restart(livePages: readonly PortFrame<Port>[]): void {
    for (const frame of livePages) waiting.add(frame);
    child = start();
  }

  function forgetDestroyed(): PortFrame<Port>[] {
    for (const frame of pages.keys()) {
      if (frame.isDestroyed()) {
        pages.delete(frame);
        waiting.delete(frame);
      }
    }
    return [...pages.keys()];
  }

  function connect(frame: PortFrame<Port>): void {
    const page = pages.get(frame);
    if (page === undefined || frame.isDestroyed()) {
      pages.delete(frame);
      return;
    }
    const { port1, port2 } = createChannel();
    frame.postMessage(PORT_CHANNEL, null, [port2]);
    child.postMessage(portHandoff(page), [port1]);
  }

  return {
    handPort(frame) {
      if (phase === "ended" || frame.isDestroyed()) return;
      if (!pages.has(frame)) pages.set(frame, ++lastPage);
      if (phase === "stopped") frame.postMessage(STOPPED_CHANNEL, null, []);
      else if (phase === "starting") waiting.add(frame);
      else connect(frame);
    },
    retry() {
      if (phase !== "stopped") return;
      crashes = [];
      restart(forgetDestroyed());
    },
    stop() {
      if (phase === "ended") return;
      phase = "ended";
      waiting.clear();
      child.kill();
    },
  };
}
