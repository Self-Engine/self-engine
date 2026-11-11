import { EventEmitter } from "node:events";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import { createDataConnection } from "@self-engine/data-client";
import type { Database } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { PORT_HANDOFF, SERVING } from "./data-process-messages.ts";
import { type ParentPort, runDataProcess } from "./data-process-runtime.ts";

/** Stands in for Electron's `process.parentPort`: the main process's side is `send`. */
class FakeParentPort extends EventEmitter implements ParentPort {
  readonly sent: unknown[] = [];
  onPost: (message: unknown) => void = () => {};

  postMessage(message: unknown): void {
    this.sent.push(message);
    this.onPost(message);
  }

  send(data: unknown, ports: MessagePort[]): void {
    this.emit("message", { data, ports });
  }
}

const opened: { database: Database; ports: MessagePort[] }[] = [];

function start(parentPort: FakeParentPort) {
  const entry = { database: openDatabase(":memory:"), ports: [] as MessagePort[] };
  opened.push(entry);
  const channel = () => {
    const { port1, port2 } = new MessageChannel();
    entry.ports.push(port1, port2);
    return { port1, port2 };
  };
  return {
    channel,
    running: runDataProcess({ parentPort, database: entry.database, migrations: [] }),
  };
}

afterEach(async () => {
  for (const { database, ports } of opened.splice(0)) {
    for (const port of ports) port.close();
    await database.close();
  }
});

describe("runDataProcess", () => {
  it("answers health on a port the main process hands over", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    expect(parentPort.sent).toEqual([SERVING]);

    const { port1, port2 } = channel();
    parentPort.send(PORT_HANDOFF, [port1]);
    const connection = createDataConnection();
    connection.connect(port2);

    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("serves a port handed over the moment it says it is serving", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    const connection = createDataConnection();
    parentPort.onPost = (message) => {
      if (message !== SERVING) return;
      const { port1, port2 } = channel();
      parentPort.send(PORT_HANDOFF, [port1]);
      connection.connect(port2);
    };
    await running;

    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("serves every port it is handed, one per window or reload", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;

    const answers = [channel(), channel()].map(({ port1, port2 }) => {
      parentPort.send(PORT_HANDOFF, [port1]);
      const connection = createDataConnection();
      connection.connect(port2);
      return connection.client.health();
    });

    await expect(Promise.all(answers)).resolves.toMatchObject([
      { state: "ready" },
      { state: "ready" },
    ]);
  });
});
