// The connection state of the renderer's client (spec #29, #140), read and subscribed to from
// outside React, over the real core and Node's MessageChannel.

import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { type ConnectionStatus, createDataConnection, type DataConnection } from "./index.ts";

let dataProcess: TestDataProcess | undefined;
const connections: DataConnection[] = [];

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.disconnect();
  await dataProcess?.close();
  dataProcess = undefined;
});

function newConnection(): DataConnection {
  const connection = createDataConnection();
  connections.push(connection);
  return connection;
}

/** Every status the connection reports from now on, in order. */
function recordStatuses(connection: DataConnection): ConnectionStatus[] {
  const statuses: ConnectionStatus[] = [];
  connection.subscribe(() => statuses.push(connection.getState().status));
  return statuses;
}

function untilStatus(connection: DataConnection, status: ConnectionStatus): Promise<void> {
  return new Promise((resolve) => {
    if (connection.getState().status === status) return resolve();
    const unsubscribe = connection.subscribe(() => {
      if (connection.getState().status !== status) return;
      unsubscribe();
      resolve();
    });
  });
}

test("reports connecting until the first event has arrived, then ready", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  const statuses = recordStatuses(connection);
  expect(connection.getState()).toEqual({ status: "connecting" });

  connection.connect(dataProcess.openPort());
  expect(connection.getState()).toEqual({ status: "connecting" });
  await untilStatus(connection, "ready");

  expect(statuses).toEqual(["ready"]);
});

test("reports reconnecting after the port closes, and ready on a new port with the same client", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  const { client } = connection;
  const first = dataProcess.openPort();
  connection.connect(first);
  await untilStatus(connection, "ready");

  first.close();
  await untilStatus(connection, "reconnecting");
  const waiting = client.health();
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");

  expect(connection.client).toBe(client);
  await expect(waiting).resolves.toMatchObject({ state: "ready" });
  await expect(client.health()).resolves.toMatchObject({ state: "ready" });
});

test("reports reconnecting when told the port is gone, before the port itself closes", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");
  const statuses = recordStatuses(connection);

  connection.disconnect();
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");

  expect(statuses).toEqual(["reconnecting", "ready"]);
});

test("a port that closes before its first event leaves the connection connecting", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  const statuses = recordStatuses(connection);
  const first = dataProcess.openPort();
  connection.connect(first);
  first.close();

  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");

  expect(statuses).toEqual(["ready"]);
});

test("a subscriber stops hearing changes once it unsubscribes", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");
  let calls = 0;
  const unsubscribe = connection.subscribe(() => calls++);

  unsubscribe();
  connection.disconnect();

  expect(calls).toBe(0);
});

test("tables changed reach a listener over every port, without the opening empty event", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  const heard: string[][] = [];
  connection.onTablesChanged((tables) => heard.push([...tables]));
  const first = dataProcess.openPort();
  connection.connect(first);
  await untilStatus(connection, "ready");

  const firstHeard = new Promise<void>((resolve) => {
    const stop = connection.onTablesChanged(() => {
      stop();
      resolve();
    });
  });
  dataProcess.announceTablesChanged(["projects"]);
  await firstHeard;
  first.close();
  await untilStatus(connection, "reconnecting");
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");
  const secondHeard = new Promise<void>((resolve) => {
    const stop = connection.onTablesChanged(() => {
      stop();
      resolve();
    });
  });
  dataProcess.announceTablesChanged(["tasks"]);
  await secondHeard;

  expect(heard).toEqual([["projects"], ["tasks"]]);
});

test("reports stopped when told the data process stopped, and comes back on a retry", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");
  const statuses = recordStatuses(connection);

  connection.disconnect();
  connection.stop();
  const waiting = connection.client.health();
  // A retry: the renderer waits for a port again, and one arrives.
  connection.disconnect();
  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");

  expect(statuses).toEqual(["reconnecting", "stopped", "reconnecting", "ready"]);
  await expect(waiting).resolves.toMatchObject({ state: "ready" });
});

test("a port that arrives while stopped reconnects, as after a retry from another page", async () => {
  dataProcess = await startTestDataProcess();
  const connection = newConnection();
  connection.stop();
  const statuses = recordStatuses(connection);

  connection.connect(dataProcess.openPort());
  await untilStatus(connection, "ready");

  expect(statuses).toEqual(["connecting", "ready"]);
});
