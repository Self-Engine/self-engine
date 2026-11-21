// A start after the Data Process's "now" over the real client (D348, D369): the client sorts the
// input error `editTimer` raises into the result `invalid`, at the start, as a form receives it.
// The function form is built here; the module's timer hooks come with the Indicator Panel (#349).

import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { type DataAccess, portAccessOf, portHooks } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { createTestSources } from "@self-engine/db/testing";
import { projects } from "@self-engine/projects/data";
import { afterEach, expect, test } from "vite-plus/test";
import type { timeTrackingContract } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const timeTrackingPort = portHooks<typeof timeTrackingContract>("timeTracking");
const startTimer = timeTrackingPort.run("startTimer");
const editTimer = timeTrackingPort.run("editTimer");

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

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

test("editTimer with a start in the future answers invalid at startedAt, and keeps the timer", async () => {
  const sources = createTestSources("2026-11-16T09:00:00.000Z");
  const process = await startTestDataProcess({ modules: { projects, timeTracking }, sources });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);
  const notices: unknown[] = [];
  const data: DataAccess = {
    access: portAccessOf(connection),
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => notices.push(notice),
  };
  const started = await startTimer(data, { note: "Design" });
  if (started.status !== "success") throw new Error("The timer did not start");

  // 15:05 sets the start to 15:10, in the example of D369: here 09:00 and 09:05.
  const result = await editTimer(data, {
    id: started.data.id,
    startedAt: "2026-11-16T09:05:00.000Z",
    note: "Build",
  });

  expect(result).toEqual({
    status: "invalid",
    issues: [
      {
        field: "startedAt",
        path: ["startedAt"],
        reason: "start_in_future",
        issue: expect.objectContaining({ code: "custom" }),
      },
    ],
    atFields: [],
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toMatchObject(
    [{ id: started.data.id, startedAt: "2026-11-16T09:00:00.000Z", note: "Design" }],
  );
});
