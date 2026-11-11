import { EventEmitter } from "node:events";
import { describe, expect, it } from "vite-plus/test";
import { userDataPath } from "./channel.ts";
import {
  type PageRequest,
  databaseFile,
  isOwnPage,
  serveDataProcessRequests,
} from "./data-process-host.ts";
import { PORT_REQUEST_CHANNEL, RETRY_CHANNEL } from "./data-process-channels.ts";
import type { PortFrame } from "./data-process-supervisor.ts";
import { desktopUrl } from "./protocol.ts";

const SCHEME = "self-engine-dev";

type FakePort = never;

class FakeFrame implements PortFrame<FakePort> {
  readonly url: string;
  readonly parent: unknown;

  constructor(url: string, parent: unknown = null) {
    this.url = url;
    this.parent = parent;
  }

  isDestroyed(): boolean {
    return false;
  }

  postMessage(): void {}
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

describe("isOwnPage", () => {
  it("accepts our page in the main frame", () => {
    expect(isOwnPage(new FakeFrame(`${desktopUrl(SCHEME)}#/projects`), SCHEME)).toBe(true);
  });

  it("refuses our page in a subframe", () => {
    const main = new FakeFrame(desktopUrl(SCHEME));
    expect(isOwnPage(new FakeFrame(desktopUrl(SCHEME), main), SCHEME)).toBe(false);
  });

  it.each([
    ["another site", "https://example.com/"],
    ["another channel's scheme", desktopUrl("self-engine")],
  ])("refuses %s", (_name, url) => {
    expect(isOwnPage(new FakeFrame(url), SCHEME)).toBe(false);
  });
});

describe("serveDataProcessRequests", () => {
  function serveRequests() {
    const handed: PortFrame<FakePort>[] = [];
    let retries = 0;
    const ipc = new EventEmitter();
    serveDataProcessRequests(
      ipc,
      { handPort: (frame) => handed.push(frame), retry: () => retries++ },
      SCHEME,
    );
    const send = (channel: string, event: PageRequest<FakePort>) => ipc.emit(channel, event);
    return { send, handed, retries: () => retries };
  }

  it("answers our page in the main frame", () => {
    const { send, handed, retries } = serveRequests();
    const frame = new FakeFrame(`${desktopUrl(SCHEME)}#/projects`);

    send(PORT_REQUEST_CHANNEL, { senderFrame: frame, sender: { mainFrame: frame } });
    send(RETRY_CHANNEL, { senderFrame: frame, sender: { mainFrame: frame } });

    expect(handed).toEqual([frame]);
    expect(retries()).toBe(1);
  });

  it.each([PORT_REQUEST_CHANNEL, RETRY_CHANNEL])("refuses a subframe on %s", (channel) => {
    const { send, handed, retries } = serveRequests();
    const frame = new FakeFrame(desktopUrl(SCHEME));

    send(channel, { senderFrame: frame, sender: { mainFrame: new FakeFrame(desktopUrl(SCHEME)) } });

    expect(handed).toEqual([]);
    expect(retries()).toBe(0);
  });

  it.each([
    ["another site", "https://example.com/"],
    ["another channel's scheme", desktopUrl("self-engine")],
  ])("refuses %s in the main frame", (_name, url) => {
    const { send, handed, retries } = serveRequests();
    const frame = new FakeFrame(url);

    send(PORT_REQUEST_CHANNEL, { senderFrame: frame, sender: { mainFrame: frame } });
    send(RETRY_CHANNEL, { senderFrame: frame, sender: { mainFrame: frame } });

    expect(handed).toEqual([]);
    expect(retries()).toBe(0);
  });

  it("ignores a request whose frame is already gone", () => {
    const { send, handed } = serveRequests();
    const mainFrame = new FakeFrame(desktopUrl(SCHEME));

    expect(() =>
      send(PORT_REQUEST_CHANNEL, { senderFrame: null, sender: { mainFrame } }),
    ).not.toThrow();

    expect(handed).toEqual([]);
  });
});
