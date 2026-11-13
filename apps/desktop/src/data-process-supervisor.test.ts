// Seam 2 of spec #29: the supervisor with a fake process and an injected clock.

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vite-plus/test";
import type { Health } from "@self-engine/data-protocol";
import {
  FAILED_CHANNEL,
  GONE_CHANNEL,
  PORT_CHANNEL,
  STOPPED_CHANNEL,
} from "./data-process-channels.ts";
import {
  databasePathFromArgs,
  handoffPage,
  restartMessage,
  servingMessage,
} from "./data-process-messages.ts";
import {
  type DataProcessChild,
  type PortFrame,
  superviseDataProcess,
} from "./data-process-supervisor.ts";

interface FakePort {
  readonly name: string;
}

class FakeChild extends EventEmitter implements DataProcessChild<FakePort> {
  readonly received: { page: number | undefined; ports: FakePort[] }[] = [];
  killed = false;
  /** False for a test that lets the exit follow the kill later, as it does in Electron. */
  exitsOnKill = true;

  postMessage(message: unknown, transfer: FakePort[]): void {
    this.received.push({ page: handoffPage(message), ports: transfer });
  }

  kill(): boolean {
    this.killed = true;
    // Electron reports a wanted stop as an exit too.
    if (this.exitsOnKill) this.emit("exit", 0);
    return true;
  }

  /** Asks to be started anew, as after a restore. */
  askForRestart(): void {
    this.emit("message", restartMessage());
  }

  serve(health: Health = READY): void {
    this.emit("message", servingMessage(health));
  }

  crash(): void {
    this.emit("exit", 1);
  }
}

const READY: Health = { state: "ready", sqliteVersion: "3.50.0", migrations: [] };
const OWN_PAGE = "self-engine-dev://app/";

class FakeFrame implements PortFrame<FakePort> {
  readonly received: { channel: string; message: unknown; ports: FakePort[] }[] = [];
  destroyed = false;
  url = OWN_PAGE;
  readonly parent = null;

  isDestroyed(): boolean {
    return this.destroyed;
  }

  postMessage(channel: string, message: unknown, transfer: FakePort[]): void {
    this.received.push({ channel, message, ports: transfer });
  }

  channels(): string[] {
    return this.received.map(({ channel }) => channel);
  }
}

const SECOND = 1000;

function supervise() {
  const children: FakeChild[] = [];
  const starts: string[][] = [];
  let time = 0;
  let channels = 0;
  const supervisor = superviseDataProcess<FakePort>({
    databasePath: "/data/self-engine.sqlite",
    startProcess: (args) => {
      starts.push(args);
      const child = new FakeChild();
      children.push(child);
      return child;
    },
    createChannel: () => {
      channels += 1;
      return { port1: { name: `data-${channels}` }, port2: { name: `page-${channels}` } };
    },
    now: () => time,
    isOwnPage: (frame) => frame.url === OWN_PAGE,
  });
  const latest = (): FakeChild => {
    const child = children.at(-1);
    if (child === undefined) throw new Error("No data process was started");
    return child;
  };
  const advance = (milliseconds: number) => {
    time += milliseconds;
  };
  return { supervisor, children, starts, latest, advance };
}

describe("superviseDataProcess", () => {
  it("starts the data process with the database file", () => {
    const { starts } = supervise();
    expect(starts).toHaveLength(1);
    expect(databasePathFromArgs(["electron", ...(starts[0] ?? [])])).toBe(
      "/data/self-engine.sqlite",
    );
  });

  it("hands a page its port only once the data process is serving", () => {
    const { supervisor, latest } = supervise();
    const frame = new FakeFrame();

    supervisor.handPort(frame);
    expect(frame.received).toEqual([]);
    expect(latest().received).toEqual([]);

    latest().serve();
    expect(frame.received).toEqual([
      { channel: PORT_CHANNEL, message: null, ports: [{ name: "page-1" }] },
    ]);
    expect(latest().received).toEqual([{ page: 1, ports: [{ name: "data-1" }] }]);
  });

  it("gives every request a channel of its own, marked with the same page, as after a reload", () => {
    const { supervisor, latest } = supervise();
    latest().serve();
    const frame = new FakeFrame();
    const other = new FakeFrame();

    supervisor.handPort(frame);
    supervisor.handPort(frame);
    supervisor.handPort(other);

    expect(frame.received.map(({ ports }) => ports)).toEqual([
      [{ name: "page-1" }],
      [{ name: "page-2" }],
    ]);
    expect(latest().received).toEqual([
      { page: 1, ports: [{ name: "data-1" }] },
      { page: 1, ports: [{ name: "data-2" }] },
      { page: 2, ports: [{ name: "data-3" }] },
    ]);
  });

  it("hands nothing to a page that closed while the data process started", () => {
    const { supervisor, latest } = supervise();
    const frame = new FakeFrame();
    supervisor.handPort(frame);
    frame.destroyed = true;

    latest().serve();

    expect(frame.received).toEqual([]);
    expect(latest().received).toEqual([]);
  });

  it("restarts after an unexpected exit, tells the page and hands it a fresh port", () => {
    const { supervisor, children, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);

    latest().crash();
    expect(children).toHaveLength(2);
    expect(frame.channels()).toEqual([PORT_CHANNEL, GONE_CHANNEL]);

    latest().serve();
    expect(frame.received.at(-1)).toEqual({
      channel: PORT_CHANNEL,
      message: null,
      ports: [{ name: "page-2" }],
    });
    expect(latest().received).toEqual([{ page: 1, ports: [{ name: "data-2" }] }]);
  });

  it("starts the data process anew when it asks for it, tells the page and hands it a fresh port", () => {
    const { supervisor, children, starts, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);
    const asking = latest();

    asking.askForRestart();
    expect(asking.killed).toBe(true);
    expect(children).toHaveLength(2);
    expect(starts[1]).toEqual(starts[0]);
    expect(frame.channels()).toEqual([PORT_CHANNEL, GONE_CHANNEL]);

    latest().serve();
    expect(frame.received.at(-1)).toEqual({
      channel: PORT_CHANNEL,
      message: null,
      ports: [{ name: "page-2" }],
    });
    expect(latest().received).toEqual([{ page: 1, ports: [{ name: "data-2" }] }]);
  });

  it("starts the next data process only after the one that asked has exited", () => {
    const { supervisor, children, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);
    const asking = latest();
    asking.exitsOnKill = false;

    asking.askForRestart();
    // The page already waits for its fresh port; the database file is still open over there.
    expect(frame.channels()).toEqual([PORT_CHANNEL, GONE_CHANNEL]);
    expect(children).toHaveLength(1);

    asking.emit("exit", 0);
    expect(children).toHaveLength(2);
  });

  it("counts no crash for a restart the data process asked for", () => {
    const { supervisor, children, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);

    for (let restore = 0; restore < 5; restore++) {
      latest().askForRestart();
      latest().serve();
    }

    expect(children).toHaveLength(6);
    expect(frame.channels()).not.toContain(STOPPED_CHANNEL);
    expect(frame.channels().at(-1)).toBe(PORT_CHANNEL);
  });

  it("lets a page that asks during such a restart wait for the fresh port", () => {
    const { supervisor, latest } = supervise();
    latest().serve();
    const asking = latest();
    asking.exitsOnKill = false;
    asking.askForRestart();
    const frame = new FakeFrame();

    supervisor.handPort(frame);
    expect(frame.received).toEqual([]);
    expect(asking.received).toEqual([]);

    asking.emit("exit", 0);
    latest().serve();
    expect(frame.channels()).toEqual([PORT_CHANNEL]);
  });

  it("ignores a restart request from a data process that does not serve", () => {
    const { children, latest } = supervise();

    latest().askForRestart();
    expect(latest().killed).toBe(false);

    latest().serve({ state: "migrationFailed", migration: "time/0003" });
    latest().askForRestart();
    expect(latest().killed).toBe(false);
    expect(children).toHaveLength(1);
  });

  it("restarts a data process that exits before it serves, and answers the waiting page", () => {
    const { supervisor, children, latest } = supervise();
    const frame = new FakeFrame();
    supervisor.handPort(frame);

    latest().crash();
    latest().serve();

    expect(children).toHaveLength(2);
    expect(frame.channels()).toEqual([GONE_CHANNEL, PORT_CHANNEL]);
  });

  it("forgets a page that closed, so a restart hands it nothing", () => {
    const { supervisor, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);
    frame.destroyed = true;

    latest().crash();
    latest().serve();

    expect(frame.channels()).toEqual([PORT_CHANNEL]);
    expect(latest().received).toEqual([]);
  });

  it("stops after three unexpected exits within one minute and tells the page", () => {
    const { supervisor, children, latest, advance } = supervise();
    const frame = new FakeFrame();
    supervisor.handPort(frame);

    latest().crash();
    advance(30 * SECOND);
    latest().crash();
    advance(29 * SECOND);
    latest().crash();

    expect(children).toHaveLength(3);
    expect(frame.channels()).toEqual([GONE_CHANNEL, GONE_CHANNEL, GONE_CHANNEL, STOPPED_CHANNEL]);
  });

  it("keeps restarting when three exits are spread over more than a minute", () => {
    const { children, latest, advance } = supervise();

    latest().crash();
    advance(30 * SECOND);
    latest().crash();
    advance(31 * SECOND);
    latest().crash();

    expect(children).toHaveLength(4);
  });

  it("tells a page that asks while stopped that the data process stopped", () => {
    const { supervisor, latest } = supervise();
    for (let exit = 0; exit < 3; exit++) latest().crash();
    const reloaded = new FakeFrame();

    supervisor.handPort(reloaded);

    expect(reloaded.channels()).toEqual([STOPPED_CHANNEL]);
  });

  it("starts a new process on a retry, hands the page a port and counts from zero", () => {
    const { supervisor, children, latest } = supervise();
    const frame = new FakeFrame();
    supervisor.handPort(frame);
    for (let exit = 0; exit < 3; exit++) latest().crash();

    supervisor.retry();
    expect(children).toHaveLength(4);
    latest().serve();
    expect(frame.received.at(-1)).toEqual({
      channel: PORT_CHANNEL,
      message: null,
      ports: [{ name: "page-1" }],
    });

    latest().crash();
    latest().crash();
    expect(children).toHaveLength(6);
  });

  it("starts nothing on a retry while the data process runs", () => {
    const { supervisor, children, latest } = supervise();
    latest().serve();

    supervisor.retry();

    expect(children).toHaveLength(1);
  });

  it("does not restart a data process in a failure state, and keeps reporting the failure", () => {
    const failures: Health[] = [
      { state: "migrationFailed", migration: "time/0002" },
      { state: "databaseNewer", migration: "finance/0007" },
    ];
    for (const failure of failures) {
      const { supervisor, children, latest } = supervise();
      const frame = new FakeFrame();
      supervisor.handPort(frame);
      latest().serve(failure);
      expect(frame.channels()).toEqual([PORT_CHANNEL]);

      latest().crash();

      expect(children).toHaveLength(1);
      expect(frame.received.at(-1)).toEqual({
        channel: FAILED_CHANNEL,
        message: failure,
        ports: [],
      });
      expect(frame.channels()).toEqual([PORT_CHANNEL, FAILED_CHANNEL]);

      const reloaded = new FakeFrame();
      supervisor.handPort(reloaded);
      expect(reloaded.received).toEqual([{ channel: FAILED_CHANNEL, message: failure, ports: [] }]);

      supervisor.retry();
      expect(children).toHaveLength(1);
    }
  });

  it("hands a restarted data process's port only to a frame that still shows our page", () => {
    const { supervisor, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);
    frame.url = "https://example.com/";

    latest().crash();
    latest().serve();

    expect(frame.channels()).toEqual([PORT_CHANNEL]);
    expect(latest().received).toEqual([]);

    // Back on our page, it asks again and gets a port for the same page number.
    frame.url = OWN_PAGE;
    supervisor.handPort(frame);
    expect(frame.channels()).toEqual([PORT_CHANNEL, PORT_CHANNEL]);
    expect(latest().received).toEqual([{ page: 1, ports: [{ name: "data-2" }] }]);
  });

  it("treats a wanted stop, such as quitting the app, as no crash and starts nothing", () => {
    const { supervisor, children, latest } = supervise();
    const frame = new FakeFrame();
    latest().serve();
    supervisor.handPort(frame);

    supervisor.stop();

    expect(latest().killed).toBe(true);
    expect(children).toHaveLength(1);
    expect(frame.channels()).toEqual([PORT_CHANNEL]);
    supervisor.retry();
    supervisor.handPort(new FakeFrame());
    expect(children).toHaveLength(1);
  });

  it("ignores an exit of a process it already replaced", () => {
    const { children, latest } = supervise();
    const first = latest();
    first.crash();

    first.crash();

    expect(children).toHaveLength(2);
  });
});
