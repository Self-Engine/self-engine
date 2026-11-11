import { EventEmitter } from "node:events";
import { describe, expect, it } from "vite-plus/test";
import { userDataPath } from "./channel.ts";
import {
  type DataProcessChild,
  type PortFrame,
  type PortRequest,
  databaseFile,
  servePortRequests,
  startDataProcessHost,
} from "./data-process-host.ts";
import {
  PORT_CHANNEL,
  PORT_HANDOFF,
  PORT_REQUEST_CHANNEL,
  SERVING,
  databasePathFromArgs,
} from "./data-process-messages.ts";
import { desktopUrl } from "./protocol.ts";

const SCHEME = "self-engine-dev";

interface FakePort {
  readonly name: string;
}

class FakeChild extends EventEmitter implements DataProcessChild<FakePort> {
  readonly received: { message: unknown; ports: FakePort[] }[] = [];

  postMessage(message: unknown, transfer: FakePort[]): void {
    this.received.push({ message, ports: transfer });
  }

  serve(): void {
    this.emit("message", SERVING);
  }
}

class FakeFrame implements PortFrame<FakePort> {
  readonly received: { channel: string; ports: FakePort[] }[] = [];
  destroyed = false;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  postMessage(channel: string, _message: unknown, transfer: FakePort[]): void {
    this.received.push({ channel, ports: transfer });
  }
}

function startHost() {
  const child = new FakeChild();
  const starts: string[][] = [];
  let channels = 0;
  const host = startDataProcessHost<FakePort>({
    databasePath: "/data/self-engine.sqlite",
    startProcess: (args) => {
      starts.push(args);
      return child;
    },
    createChannel: () => {
      channels += 1;
      return { port1: { name: `data-${channels}` }, port2: { name: `page-${channels}` } };
    },
  });
  return { child, host, starts };
}

// Lets the host's awaited promises settle; no clock involved.
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("databaseFile", () => {
  it("lies in the channel's data folder, which --user-data-dir moves", () => {
    expect(databaseFile("/Users/me/Library/Application Support/Self-Engine")).toBe(
      "/Users/me/Library/Application Support/Self-Engine/self-engine.sqlite",
    );
    const moved = userDataPath("/appData", "Self-Engine Dev", "/tmp/smoke");
    expect(databaseFile(moved)).toBe("/tmp/smoke/self-engine.sqlite");
  });
});

describe("startDataProcessHost", () => {
  it("starts the data process with the database file", () => {
    const { starts } = startHost();
    expect(starts).toHaveLength(1);
    expect(databasePathFromArgs(["electron", ...(starts[0] ?? [])])).toBe(
      "/data/self-engine.sqlite",
    );
  });

  it("hands a page its port only once the data process is serving", async () => {
    const { child, host } = startHost();
    const frame = new FakeFrame(desktopUrl(SCHEME));

    const handed = host.handPort(frame);
    await settle();
    expect(frame.received).toEqual([]);
    expect(child.received).toEqual([]);

    child.serve();
    await handed;
    expect(frame.received).toEqual([{ channel: PORT_CHANNEL, ports: [{ name: "page-1" }] }]);
    expect(child.received).toEqual([{ message: PORT_HANDOFF, ports: [{ name: "data-1" }] }]);
  });

  it("gives every request a channel of its own, as after a reload", async () => {
    const { child, host } = startHost();
    child.serve();
    const frame = new FakeFrame(desktopUrl(SCHEME));

    await host.handPort(frame);
    await host.handPort(frame);

    expect(frame.received.map(({ ports }) => ports)).toEqual([
      [{ name: "page-1" }],
      [{ name: "page-2" }],
    ]);
    expect(child.received.map(({ ports }) => ports)).toEqual([
      [{ name: "data-1" }],
      [{ name: "data-2" }],
    ]);
  });

  it("hands nothing to a page that closed while the data process started", async () => {
    const { child, host } = startHost();
    const frame = new FakeFrame(desktopUrl(SCHEME));
    const handed = host.handPort(frame);
    frame.destroyed = true;

    child.serve();
    await handed;

    expect(frame.received).toEqual([]);
    expect(child.received).toEqual([]);
  });
});

describe("servePortRequests", () => {
  function serveRequests() {
    const { child, host } = startHost();
    child.serve();
    const ipc = new EventEmitter();
    servePortRequests(ipc, host, SCHEME);
    const request = (event: PortRequest<FakePort>) => ipc.emit(PORT_REQUEST_CHANNEL, event);
    return { request };
  }

  it("answers our page in the main frame", async () => {
    const { request } = serveRequests();
    const frame = new FakeFrame(`${desktopUrl(SCHEME)}#/projects`);

    request({ senderFrame: frame, sender: { mainFrame: frame } });
    await settle();

    expect(frame.received).toEqual([{ channel: PORT_CHANNEL, ports: [{ name: "page-1" }] }]);
  });

  it("refuses a subframe", async () => {
    const { request } = serveRequests();
    const frame = new FakeFrame(desktopUrl(SCHEME));

    request({ senderFrame: frame, sender: { mainFrame: new FakeFrame(desktopUrl(SCHEME)) } });
    await settle();

    expect(frame.received).toEqual([]);
  });

  it.each([
    ["another site", "https://example.com/"],
    ["another channel's scheme", desktopUrl("self-engine")],
  ])("refuses %s in the main frame", async (_name, url) => {
    const { request } = serveRequests();
    const frame = new FakeFrame(url);

    request({ senderFrame: frame, sender: { mainFrame: frame } });
    await settle();

    expect(frame.received).toEqual([]);
  });

  it("ignores a request whose frame is already gone", async () => {
    const { request } = serveRequests();
    const mainFrame = new FakeFrame(desktopUrl(SCHEME));

    expect(() => request({ senderFrame: null, sender: { mainFrame } })).not.toThrow();
    await settle();

    expect(mainFrame.received).toEqual([]);
  });
});
