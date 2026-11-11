// The main seam of the data process (spec #29): the real client talks to the real core over
// Node's MessageChannel and an in-memory SQLite database, without Electron.

import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createDataConnection } from "./index.ts";

let dataProcess: TestDataProcess | undefined;

afterEach(async () => {
  vi.useRealTimers();
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

test.each(["initial", "disconnected", "stopped"])(
  "a waiting call can be aborted while %s",
  async (phase) => {
    dataProcess = await startTestDataProcess();
    const connection = createDataConnection();
    if (phase !== "initial") {
      connection.connect(dataProcess.openPort());
      await connection.client.health();
      if (phase === "disconnected") connection.disconnect();
      else connection.stop();
    }
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error("cancelled while waiting");
    const answer = connection.client.health(undefined, { signal: controller.signal });
    const outcome = answer.catch((error: unknown) => error);
    controller.abort(reason);
    await vi.runAllTimersAsync();
    expect(await Promise.race([outcome, Promise.resolve("still waiting")])).toBe(reason);
  },
);

test("a waiting call removes its abort listener when a port arrives", async () => {
  dataProcess = await startTestDataProcess();
  const connection = createDataConnection();
  const controller = new AbortController();
  const add = vi.spyOn(controller.signal, "addEventListener");
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const answer = connection.client.health(undefined, { signal: controller.signal });
  const waitingListener = add.mock.calls.find(([event]) => event === "abort")?.[1];
  expect(waitingListener).toBeDefined();
  connection.connect(dataProcess.openPort());
  await expect(answer).resolves.toMatchObject({ state: "ready" });
  expect(remove).toHaveBeenCalledWith("abort", waitingListener);
});

test("a call with an already aborted signal rejects before a port arrives", async () => {
  const connection = createDataConnection();
  const reason = new Error("already cancelled");
  await expect(
    connection.client.health(undefined, { signal: AbortSignal.abort(reason) }),
  ).rejects.toBe(reason);
});
