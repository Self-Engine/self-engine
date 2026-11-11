// The main seam of the data process (spec #29): the real client talks to the real core over
// Node's MessageChannel and an in-memory SQLite database, without Electron.

import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createDataConnection } from "./index.ts";

let dataProcess: TestDataProcess | undefined;

afterEach(async () => {
  await dataProcess?.close();
  dataProcess = undefined;
});

describe("a typed call over a message port", () => {
  test("health answers ready with the SQLite version and no migrations", async () => {
    dataProcess = await startTestDataProcess();
    const connection = createDataConnection();
    connection.connect(dataProcess.openPort());

    await expect(connection.client.health()).resolves.toEqual({
      state: "ready",
      sqliteVersion: expect.stringMatching(/^3\.\d+\.\d+$/),
      migrations: [],
    });
  });

  test("a fixture migration has run before the first call is answered", async () => {
    dataProcess = await startTestDataProcess({
      migrations: [
        { name: "fixture/0001", sql: "CREATE TABLE fixtures (id TEXT PRIMARY KEY) STRICT;" },
      ],
    });
    const connection = createDataConnection();
    connection.connect(dataProcess.openPort());

    await expect(connection.client.health()).resolves.toMatchObject({
      state: "ready",
      migrations: ["fixture/0001"],
    });
  });

  test("a call made before the port arrives is answered once it does", async () => {
    dataProcess = await startTestDataProcess();
    const connection = createDataConnection();

    const answer = connection.client.health();
    connection.connect(dataProcess.openPort());

    await expect(answer).resolves.toMatchObject({ state: "ready" });
  });

  test("calls after a new port go over that port", async () => {
    dataProcess = await startTestDataProcess();
    const connection = createDataConnection();
    const first = dataProcess.openPort();
    connection.connect(first);
    await connection.client.health();

    first.close();
    connection.connect(dataProcess.openPort());

    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });
});
