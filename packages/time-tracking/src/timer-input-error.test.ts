// A start or an end after the Data Process's "now" over the real client (D348, D369): the client
// sorts the input errors `editTimer` and `stopTimer` raise into the result `invalid`, at the field,
// as a form receives them.
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
const stopTimer = timeTrackingPort.run("stopTimer");

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

/** The test Data Process at 09:00, the client's Port access over it, and one running timer. */
async function startWithATimer() {
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
  return { data, id: started.data.timer.id };
}

/** The result `invalid` with one issue of the Operation, at `field` with `reason`. */
const invalidAt = (field: string, reason: string) => ({
  status: "invalid",
  issues: [{ field, path: [field], reason, issue: expect.objectContaining({ code: "custom" }) }],
  atFields: [],
});

test("editTimer with a start in the future answers invalid at startedAt, and keeps the timer", async () => {
  const { data, id } = await startWithATimer();

  // 15:05 sets the start to 15:10, in the example of D369: here 09:00 and 09:05.
  const result = await editTimer(data, {
    id,
    startedAt: "2026-11-16T09:05:00.000Z",
    note: "Build",
  });

  expect(result).toEqual(invalidAt("startedAt", "start_in_future"));
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toMatchObject(
    [{ id, startedAt: "2026-11-16T09:00:00.000Z", note: "Design" }],
  );
});

test("stopTimer with an end in the future, or not after the start, answers invalid at endedAt", async () => {
  const { data, id } = await startWithATimer();

  const later = await stopTimer(data, { id, endedAt: "2026-11-16T09:05:00.000Z" });
  const before = await stopTimer(data, { id, endedAt: "2026-11-16T08:59:00.000Z" });

  expect(later).toEqual(invalidAt("endedAt", "end_in_future"));
  expect(before).toEqual(invalidAt("endedAt", "end_before_start"));
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toMatchObject(
    [{ id }],
  );
});
