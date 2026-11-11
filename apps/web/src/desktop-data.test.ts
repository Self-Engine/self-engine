import { MessageChannel, type MessagePort } from "node:worker_threads";
import { createDataConnection } from "@self-engine/data-client";
import { CONNECTION_MARK, pageMessageData } from "@self-engine/desktop-bridge";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  type DesktopDataWindow,
  type PortMessage,
  connectDesktopData,
  markConnectionStates,
  retryDesktopData,
} from "./desktop-data.ts";

const ORIGIN = "self-engine-dev://app";
const PAGE_PORT_MESSAGE = pageMessageData({ kind: "port" });
const PAGE_GONE_MESSAGE = pageMessageData({ kind: "gone" });
const PAGE_STOPPED_MESSAGE = pageMessageData({ kind: "stopped" });

class FakeWindow implements DesktopDataWindow {
  readonly location = { origin: ORIGIN };
  readonly listeners: ((event: PortMessage) => void)[] = [];

  addEventListener(_type: "message", listener: (event: PortMessage) => void): void {
    this.listeners.push(listener);
  }

  receive(data: unknown, origin: string, ports: MessagePort[]): void {
    // Node's ports stand in for the DOM's, which the page gets.
    const event = { data, origin, ports: ports as unknown as PortMessage["ports"] };
    for (const listener of this.listeners) listener(event);
  }
}

const channels: MessageChannel[] = [];

function port(): MessagePort {
  const channel = new MessageChannel();
  channels.push(channel);
  return channel.port1;
}

afterEach(() => {
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close();
    port2.close();
  }
});

function connectFake() {
  const win = new FakeWindow();
  const connected: unknown[] = [];
  const calls: string[] = [];
  const listenersAtRequest: number[] = [];
  const bridge = { requestDataPort: () => listenersAtRequest.push(win.listeners.length) };
  connectDesktopData(win, bridge, {
    connect: (received) => {
      calls.push("connect");
      connected.push(received);
    },
    disconnect: () => calls.push("disconnect"),
    stop: () => calls.push("stop"),
    fail: (failure) => calls.push(`fail ${failure.state} ${failure.migration}`),
  });
  return { win, connected, calls, listenersAtRequest };
}

describe("connectDesktopData", () => {
  it("asks for a port once it listens for one", () => {
    const { listenersAtRequest } = connectFake();
    expect(listenersAtRequest).toEqual([1]);
  });

  it("connects the port the preload posts from the page's own origin", () => {
    const { win, connected } = connectFake();
    const received = port();

    win.receive(PAGE_PORT_MESSAGE, ORIGIN, [received]);

    expect(connected).toEqual([received]);
  });

  it("refuses a port from another origin", () => {
    const { win, connected } = connectFake();

    win.receive(PAGE_PORT_MESSAGE, "https://example.com", [port()]);

    expect(connected).toEqual([]);
  });

  it("ignores other messages of its own origin", () => {
    const { win, connected } = connectFake();

    win.receive("something else", ORIGIN, [port()]);
    win.receive(PAGE_PORT_MESSAGE, ORIGIN, []);

    expect(connected).toEqual([]);
  });
});

describe("the data process's news", () => {
  it("drops the port when the data process is gone, and connects the fresh one", () => {
    const { win, calls } = connectFake();
    win.receive(PAGE_PORT_MESSAGE, ORIGIN, [port()]);

    win.receive(PAGE_GONE_MESSAGE, ORIGIN, []);
    win.receive(PAGE_PORT_MESSAGE, ORIGIN, [port()]);

    expect(calls).toEqual(["connect", "disconnect", "connect"]);
  });

  it("reports a stopped data process", () => {
    const { win, calls } = connectFake();

    win.receive(PAGE_STOPPED_MESSAGE, ORIGIN, []);

    expect(calls).toEqual(["stop"]);
  });

  it("reports the failure state a data process exited in", () => {
    const { win, calls } = connectFake();
    const failure = { state: "migrationFailed", migration: "time/0002" } as const;

    win.receive(pageMessageData({ kind: "failed", failure }), ORIGIN, []);

    expect(calls).toEqual(["fail migrationFailed time/0002"]);
  });

  it("refuses the news from another origin", () => {
    const { win, calls } = connectFake();

    win.receive(PAGE_GONE_MESSAGE, "https://example.com", []);
    win.receive(PAGE_STOPPED_MESSAGE, "https://example.com", []);

    expect(calls).toEqual([]);
  });
});

describe("retryDesktopData", () => {
  it("waits for a port again, then asks the desktop app to start the data process", () => {
    const calls: string[] = [];

    retryDesktopData(
      { retryDataProcess: () => calls.push("retry") },
      { disconnect: () => calls.push("disconnect") },
    );

    expect(calls).toEqual(["disconnect", "retry"]);
  });
});

describe("markConnectionStates", () => {
  it("marks the state it starts in and every change, for the desktop smoke test", () => {
    const connection = createDataConnection();
    const marks: [string, unknown][] = [];
    markConnectionStates(connection, (name, options) => marks.push([name, options.detail]));
    connection.disconnect();
    connection.stop();
    expect(marks).toEqual([
      [CONNECTION_MARK, "connecting"],
      [CONNECTION_MARK, "stopped"],
    ]);
  });
});
