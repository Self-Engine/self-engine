import { EventEmitter } from "node:events";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import { createDataConnection } from "@self-engine/data-client";
import type { Database, Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { portHandoff, servingHealth } from "./data-process-messages.ts";
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

function start(parentPort: FakeParentPort, migrations?: readonly Migration[]) {
  const entry = { database: openDatabase(":memory:"), ports: [] as MessagePort[] };
  opened.push(entry);
  const channel = () => {
    const { port1, port2 } = new MessageChannel();
    entry.ports.push(port1, port2);
    return { port1, port2 };
  };
  return {
    channel,
    running: runDataProcess({
      parentPort,
      database: entry.database,
      checkOutputs: true,
      ...(migrations === undefined
        ? {}
        : {
            modules: {
              fixture: { name: "fixture", migrations, contract: {}, rowMap: {}, entries: {} },
            },
          }),
    }),
  };
}

afterEach(async () => {
  for (const { database, ports } of opened.splice(0)) {
    for (const port of ports) port.close();
    await database.close();
  }
});

describe("runDataProcess", () => {
  it("starts from the core module list without app-composed migrations and answers health", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    expect(parentPort.sent.map((message) => servingHealth(message)?.state)).toEqual(["ready"]);

    const { port1, port2 } = channel();
    parentPort.send(portHandoff(1), [port1]);
    const connection = createDataConnection();
    connection.connect(port2);

    await expect(connection.client.health()).resolves.toMatchObject({
      state: "ready",
      migrations: [],
    });
  });

  it("serves a port handed over the moment it says it is serving", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    const connection = createDataConnection();
    parentPort.onPost = (message) => {
      if (servingHealth(message) === undefined) return;
      const { port1, port2 } = channel();
      parentPort.send(portHandoff(1), [port1]);
      connection.connect(port2);
    };
    await running;

    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("serves every port it is handed, one per window or reload", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;

    const answers = [channel(), channel()].map(({ port1, port2 }, index) => {
      parentPort.send(portHandoff(index + 1), [port1]);
      const connection = createDataConnection();
      connection.connect(port2);
      return connection.client.health();
    });

    await expect(Promise.all(answers)).resolves.toMatchObject([
      { state: "ready" },
      { state: "ready" },
    ]);
  });

  it("closes a page's earlier port when the page gets a new one, as after a reload", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    const before = channel();
    parentPort.send(portHandoff(1), [before.port1]);
    const reloaded = createDataConnection();
    reloaded.connect(before.port2);
    await reloaded.client.health();
    const closed = new Promise<void>((resolve) => before.port2.once("close", () => resolve()));

    const after = channel();
    parentPort.send(portHandoff(1), [after.port1]);
    const connection = createDataConnection();
    connection.connect(after.port2);

    await closed;
    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("keeps another page's port open", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    const first = channel();
    parentPort.send(portHandoff(1), [first.port1]);
    const second = channel();
    parentPort.send(portHandoff(2), [second.port1]);

    const connection = createDataConnection();
    connection.connect(first.port2);
    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("says it is serving in a failure state too, so the main process does not restart it", async () => {
    const parentPort = new FakeParentPort();
    const { running } = start(parentPort, [{ name: "fixture/0001", sql: "NOT SQL;" }]);
    await running;

    expect(parentPort.sent.map(servingHealth)).toEqual([
      { state: "migrationFailed", migration: "fixture/0001" },
    ]);
  });

  it("ignores a message that hands over no port", async () => {
    const parentPort = new FakeParentPort();
    const { running } = start(parentPort);
    await running;

    expect(() => parentPort.send("something else", [])).not.toThrow();
  });
});
