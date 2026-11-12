// The Port access over the real connection (D249): it reaches a module's entries by name, hears
// Table Changes, and says when the connection is ready again after it was lost (D250). Over the
// real core with the `notes` test module mounted, and Node's MessageChannel.

import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { notes } from "@self-engine/storage/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { createDataConnection, type DataConnection } from "../index.ts";
import { portAccessOf } from "./port-access.ts";

const started: TestDataProcess[] = [];
const connections: DataConnection[] = [];

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.disconnect();
  for (const process of started.splice(0)) await process.close();
});

async function connected(): Promise<{ process: TestDataProcess; connection: DataConnection }> {
  const process = await startTestDataProcess({ modules: { notes } });
  started.push(process);
  const connection = createDataConnection();
  connections.push(connection);
  connection.connect(process.openPort());
  await untilReady(connection);
  return { process, connection };
}

function untilReady(connection: DataConnection): Promise<void> {
  return new Promise((resolve) => {
    if (connection.getState().status === "ready") return resolve();
    const unsubscribe = connection.subscribe(() => {
      if (connection.getState().status !== "ready") return;
      unsubscribe();
      resolve();
    });
  });
}

test("calls a module's entry by its mount name and entry name", async () => {
  const { connection } = await connected();
  const access = portAccessOf(connection);

  const created = await access.call("notes", "create", { title: "Alpha", isPinned: false });
  const list = await access.call("notes", "list", {});

  expect(created).toMatchObject({ title: "Alpha" });
  expect(list).toEqual([created]);
});

test("hears the Table Change of a commit and describes the entries", async () => {
  const { connection } = await connected();
  const access = portAccessOf(connection);
  const changes: unknown[] = [];
  const tablesChanged = new Promise<void>((resolve) => {
    access.onTablesChanged((tables) => {
      changes.push(tables);
      resolve();
    });
  });

  await access.call("notes", "create", { title: "Alpha", isPinned: false });
  await tablesChanged;

  expect(changes).toEqual([["notes"]]);
  expect(access.describeEntry("notes", "list")).toEqual({ kind: "query", reads: ["notes"] });
  expect(access.describeEntry("notes", "create")).toEqual({ kind: "operation" });
});

test("reports a reconnect when ready again after the port was lost, not the first ready", async () => {
  const process = await startTestDataProcess({ modules: { notes } });
  started.push(process);
  const connection = createDataConnection();
  connections.push(connection);
  let reconnects = 0;
  portAccessOf(connection).onReconnected(() => reconnects++);

  connection.connect(process.openPort());
  await untilReady(connection);
  expect(reconnects).toBe(0);

  connection.disconnect();
  connection.connect(process.openPort());
  await untilReady(connection);
  expect(reconnects).toBe(1);

  connection.stop();
  connection.connect(process.openPort());
  await untilReady(connection);
  expect(reconnects).toBe(2);
});
