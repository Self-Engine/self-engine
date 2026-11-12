// The Query-to-tables list (D248): the Data Process sends it with the opening event of the
// Table Change stream, and the client answers from it which entries are Queries and which
// tables each reads. Over the real core and Node's MessageChannel.

import { oc } from "@orpc/contract";
import {
  type DataModules,
  startTestDataProcess,
  type TestDataProcess,
} from "@self-engine/data-process/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { createDataConnection, type DataConnection } from "./index.ts";

const started: TestDataProcess[] = [];
const connections: DataConnection[] = [];

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.disconnect();
  for (const process of started.splice(0)) await process.close();
});

/** A data entry reduced to what the list is built from: its kind and declared reads. */
function moduleWith(entries: DataModules[string]["entries"]): DataModules[string] {
  const contract = Object.fromEntries(Object.keys(entries).map((name) => [name, oc]));
  return { contract, rowMap: {}, migrations: [], entries };
}

const run = () => [];
const tasks = moduleWith({
  list: { kind: "query", reads: ["tasks", "projects"], run },
  create: { kind: "operation", run },
});
const habits = moduleWith({ get: { kind: "query", reads: ["habits"], run } });

async function start(modules: DataModules): Promise<TestDataProcess> {
  const process = await startTestDataProcess({ modules });
  started.push(process);
  return process;
}

function newConnection(): DataConnection {
  const connection = createDataConnection();
  connections.push(connection);
  return connection;
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

test("once ready, the client says for an entry whether it is a Query and which tables it reads", async () => {
  const process = await start({ tasks, habits });
  const connection = newConnection();

  connection.connect(process.openPort());
  await untilReady(connection);

  expect(connection.describeEntry("tasks", "list")).toEqual({
    kind: "query",
    reads: ["tasks", "projects"],
  });
  expect(connection.describeEntry("habits", "get")).toEqual({ kind: "query", reads: ["habits"] });
  expect(connection.describeEntry("tasks", "create")).toEqual({ kind: "operation" });
});

test("before the first opening event the client cannot tell", async () => {
  const process = await start({ tasks });
  const connection = newConnection();

  connection.connect(process.openPort());

  expect(connection.getState().status).toBe("connecting");
  expect(connection.describeEntry("tasks", "list")).toBeUndefined();
});

test("after a reconnect on a new port the client holds the list of the new connection", async () => {
  const before = await start({ tasks });
  const after = await start({
    tasks: moduleWith({ list: { kind: "query", reads: ["tasks"], run } }),
  });
  const connection = newConnection();
  const first = before.openPort();
  connection.connect(first);
  await untilReady(connection);

  first.close();
  connection.disconnect();
  connection.connect(after.openPort());
  await untilReady(connection);

  expect(connection.describeEntry("tasks", "list")).toEqual({ kind: "query", reads: ["tasks"] });
  expect(connection.describeEntry("tasks", "create")).toEqual({ kind: "operation" });
});

test("a ready subscriber already sees the new connection's list", async () => {
  const process = await start({ habits });
  const connection = newConnection();
  const seen: unknown[] = [];
  connection.subscribe(() => {
    if (connection.getState().status === "ready")
      seen.push(connection.describeEntry("habits", "get"));
  });

  connection.connect(process.openPort());
  await untilReady(connection);

  expect(seen).toEqual([{ kind: "query", reads: ["habits"] }]);
});
