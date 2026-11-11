import { MessageChannel, type MessagePort } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  type DesktopDataWindow,
  PAGE_PORT_MESSAGE,
  type PortMessage,
  connectDesktopData,
} from "./desktop-data.ts";

const ORIGIN = "self-engine-dev://app";

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
  const listenersAtRequest: number[] = [];
  const bridge = { requestDataPort: () => listenersAtRequest.push(win.listeners.length) };
  connectDesktopData(win, bridge, { connect: (received) => connected.push(received) });
  return { win, connected, listenersAtRequest };
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
