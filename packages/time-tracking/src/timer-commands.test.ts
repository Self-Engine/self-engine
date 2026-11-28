import { createDataConnection } from "@self-engine/data-client";
import { type DataAccess, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { createTestSources } from "@self-engine/db/testing";
import { projectSchema } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { runCommand, type CommandKind, type ShellCommand } from "@self-engine/shell";
import { resolveTimeZone } from "@self-engine/time";
import { afterEach, expect, test } from "vite-plus/test";
import { z } from "zod";
import { timerStartSchema } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";
import { contribution } from "./index.ts";

const openIndicatorPanel = () => {
  throw new Error("A timer Command should run without a panel");
};

const NOW = "2026-11-16T09:00:00.000Z";
const cleanups: (() => void | Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

async function start() {
  const clock = createTestSources(NOW);
  const process = await startTestDataProcess({
    modules: { projects, timeTracking },
    sources: clock,
    deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
  });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  connection.connect(process.openPort());
  cleanups.push(() => connection.disconnect());
  const data: DataAccess = {
    access: portAccessOf(connection),
    notify: () => undefined,
    notifyRefused: () => undefined,
  };
  return { data, clock };
}

function command<Kind extends CommandKind>(id: string, kind: Kind) {
  const found = contribution.commands?.find(
    (entry): entry is Extract<ShellCommand, { kind: Kind }> =>
      entry.id === id && entry.kind === kind,
  );
  if (found === undefined) throw new Error(`Missing ${kind} Command: ${id}`);
  return found;
}

test("a caller without a screen starts a timer for a project with a note and gets the timer back", async () => {
  const { data } = await start();
  const project = await data.access.call("projects", "create", { title: "Website" });
  const { id: projectId } = projectSchema.parse(project);

  const result = await runCommand(
    command("start-timer-for-project", "input"),
    { projectId, note: " Design " },
    { data },
  );

  expect(result).toMatchObject({
    ok: true,
    value: {
      status: "success",
      data: {
        timer: { id: expect.any(String), startedAt: NOW, projectId, note: "Design" },
        others: [],
      },
    },
  });
});

test("a caller without a screen stops a timer by id and gets the saved entry", async () => {
  const { data, clock } = await start();
  const project = projectSchema.parse(
    await data.access.call("projects", "create", { title: "Website" }),
  );
  const started = await runCommand(
    command("start-timer-for-project", "input"),
    { projectId: project.id, note: "Design" },
    { data },
  );
  if (!started.ok) throw started.error;
  const {
    data: { timer },
  } = z.object({ status: z.literal("success"), data: timerStartSchema }).parse(started.value);
  clock.advance(60_000);

  const stopped = await runCommand(
    command("stop-timer-by-id", "input"),
    { id: timer.id },
    { data },
  );

  expect(stopped).toMatchObject({
    ok: true,
    value: {
      status: "success",
      data: {
        kind: "saved",
        entry: {
          id: timer.id,
          startedAt: NOW,
          endedAt: "2026-11-16T09:01:00.000Z",
          projects: [{ projectId: project.id, weight: 1, projectShare: 60 }],
          note: "Design",
        },
      },
    },
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toEqual([]);
});

test("starting from the palette saves the previous timer's entry and leaves only the new timer running", async () => {
  const { data, clock } = await start();
  const project = projectSchema.parse(
    await data.access.call("projects", "create", { title: "Website" }),
  );
  await runCommand(
    command("start-timer-for-project", "input"),
    { projectId: project.id, note: "Design" },
    { data },
  );
  clock.advance(60_000);

  const result = await runCommand(command("start-timer", "open"), {}, { data, openIndicatorPanel });

  expect(result).toMatchObject({
    ok: true,
    value: {
      status: "success",
      data: {
        timer: { startedAt: "2026-11-16T09:01:00.000Z", projectId: null, note: null },
        others: [
          {
            kind: "saved",
            entry: {
              startedAt: NOW,
              endedAt: "2026-11-16T09:01:00.000Z",
              projects: [{ projectId: project.id, weight: 1, projectShare: 60 }],
              note: "Design",
            },
          },
        ],
      },
    },
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toMatchObject(
    [{ startedAt: "2026-11-16T09:01:00.000Z", projectId: null, note: null }],
  );
});

test("the palette's Stop timer reports a same-second discard, and while idle says that no timer runs", async () => {
  const { data: quiet } = await start();
  const notices: unknown[] = [];
  const data: DataAccess = { ...quiet, notify: (notice) => notices.push(notice) };
  const context = { data, openIndicatorPanel };
  const stop = () => runCommand(command("stop-timer", "open"), {}, context);

  // The value stays `null` for a caller without a screen; a person reads the Notice.
  await expect(stop()).resolves.toEqual({ ok: true, value: null });
  expect(notices).toMatchObject([{ message: "No timer is running." }]);
  notices.length = 0;
  await runCommand(command("start-timer", "open"), {}, context);

  await expect(stop()).resolves.toMatchObject({
    ok: true,
    value: { status: "success", data: { kind: "discarded", timer: { startedAt: NOW } } },
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toEqual([]);
  expect(notices).toEqual([]);
});

test("Toggle timer starts when idle and stops the running timer on the next invocation", async () => {
  const { data, clock } = await start();
  const toggle = () =>
    runCommand(command("toggle-timer", "open"), {}, { data, openIndicatorPanel });

  const started = await toggle();
  expect(started).toMatchObject({
    ok: true,
    value: { status: "success", data: { timer: { startedAt: NOW }, others: [] } },
  });
  clock.advance(60_000);

  await expect(toggle()).resolves.toMatchObject({
    ok: true,
    value: { status: "success", data: { kind: "saved", entry: { startedAt: NOW } } },
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toEqual([]);
});

test("starting for a deleted project returns the Refusal and leaves the running timer in place", async () => {
  const { data, clock } = await start();
  const { id: projectId } = projectSchema.parse(
    await data.access.call("projects", "create", { title: "Website" }),
  );
  await data.access.call("projects", "delete", { id: projectId });
  await runCommand(command("start-timer", "open"), {}, { data, openIndicatorPanel });
  clock.advance(60_000);

  await expect(
    runCommand(
      command("start-timer-for-project", "input"),
      { projectId, note: "Design" },
      { data },
    ),
  ).resolves.toMatchObject({
    ok: true,
    value: { status: "refused" },
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toMatchObject(
    [{ startedAt: NOW, projectId: null }],
  );
});

test("stopping while the clock lies before the start reports it and leaves the timer running", async () => {
  const { data, clock } = await start();
  const context = { data, openIndicatorPanel };
  await runCommand(command("start-timer", "open"), {}, context);
  clock.advance(-1_000);

  await expect(runCommand(command("stop-timer", "open"), {}, context)).resolves.toMatchObject({
    ok: true,
    value: { status: "success", data: { kind: "clockBeforeStart", timer: { startedAt: NOW } } },
  });
  await expect(data.access.call("timeTracking", "runningTimers", undefined)).resolves.toMatchObject(
    [{ startedAt: NOW }],
  );
});
