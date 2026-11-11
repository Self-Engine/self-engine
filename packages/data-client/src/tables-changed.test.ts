// The tablesChanged stream over the real core (spec #29, #140): one empty event first, then one
// event per announcement, over Node's MessageChannel.

import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { createDataConnection } from "./index.ts";

let dataProcess: TestDataProcess | undefined;

afterEach(async () => {
  await dataProcess?.close();
  dataProcess = undefined;
});

test("a subscriber receives an empty event first, then the tables an announcement names", async () => {
  dataProcess = await startTestDataProcess();
  const connection = createDataConnection();
  connection.connect(dataProcess.openPort());

  const events = await connection.client.tablesChanged();
  await expect(events.next()).resolves.toEqual({ done: false, value: [] });

  dataProcess.announceTablesChanged(["projects", "tasks"]);

  await expect(events.next()).resolves.toEqual({ done: false, value: ["projects", "tasks"] });
  await events.return?.();
});

test("an announcement made before the subscriber pulls its next event is kept for it", async () => {
  dataProcess = await startTestDataProcess();
  const connection = createDataConnection();
  connection.connect(dataProcess.openPort());

  const events = await connection.client.tablesChanged();
  await events.next();
  dataProcess.announceTablesChanged(["projects"]);
  dataProcess.announceTablesChanged(["tasks"]);

  await expect(events.next()).resolves.toEqual({ done: false, value: ["projects"] });
  await expect(events.next()).resolves.toEqual({ done: false, value: ["tasks"] });
  await events.return?.();
});
