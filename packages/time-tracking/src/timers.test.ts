// A timer through the Port of the test Data Process, as the Module Indicator, a Command or an
// assistant calls it: `projects` and `time-tracking` mounted, with a Clock the test sets.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { createTestSources } from "@self-engine/db/testing";
import { projectIdSchema } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, test } from "vite-plus/test";
import { type TimerStop, timeEntryIdOfTimer, timerIdSchema } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

/** The Data Process's "now" at the start of each test, with milliseconds to cut. */
const NOW = "2026-11-16T09:00:00.297Z";

/**
 * The test Data Process with both modules and `settings` to save the Time Zone, and the Clock it
 * reads. The device runs in Berlin.
 */
async function start() {
  const sources = createTestSources(NOW);
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    sources,
    deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
  });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<
      ProtocolContract & {
        projects: typeof projects.contract;
        timeTracking: typeof timeTracking.contract;
        settings: typeof settings.contract;
      }
    >
  >(new RPCLink({ port: process.openPort() }));
  /** Saves the Time Zone as the settings area does. */
  const saveTimeZone = (name: string) =>
    client.settings.save({ entries: [{ key: TIME_ZONE_SETTING.key, value: name }] });
  return { process, client, clock: sources, saveTimeZone };
}

/** The time entry rows with an id, live or not, as stored: no answer carries the Time Zone (D342). */
async function storedEntries(process: TestDataProcess, id: string) {
  return process.database.kysely
    .withTables<{ time_entries: { id: string; time_zone: string; deleted_at: string | null } }>()
    .selectFrom("time_entries")
    .select(["id", "time_zone", "deleted_at"])
    .where("id", "=", id)
    .execute();
}

/** The error a call answers with. */
async function errorOf(call: Promise<unknown>) {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeDefined();
  return error as { code: string; data?: { issues?: unknown[]; reasons?: unknown[] } };
}

test("start answers with the timer, and the Query returns it with its Project Reference", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website", icon: "house", color: "teal" });

  const { timer } = await client.timeTracking.startTimer({
    projectId: project.id,
    note: " Design ",
  });

  expect(timer).toEqual({
    id: expect.any(String),
    startedAt: "2026-11-16T09:00:00.000Z",
    projectId: project.id,
    note: "Design",
  });
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([
    {
      ...timer,
      project: {
        id: project.id,
        title: "Website",
        icon: "house",
        color: "teal",
        archivedAt: null,
        deletedAt: null,
      },
    },
  ]);
});

test("the start is the Data Process's now cut to the second, and no input sets it", async () => {
  const { client, clock } = await start();
  clock.advance(65_500);
  await expect(client.timeTracking.startTimer({})).resolves.toMatchObject({
    timer: { startedAt: "2026-11-16T09:01:05.000Z", projectId: null, note: null },
    others: [],
  });

  // The Operation's types refuse a start; a caller without types can still send one.
  const input = { startedAt: "2026-11-16T08:00:00.000Z" } as { note?: string };
  await expect(errorOf(client.timeTracking.startTimer(input))).resolves.toMatchObject({
    code: "BAD_REQUEST",
    data: { issues: [{ code: "unrecognized_keys", keys: ["startedAt"] }] },
  });
  await expect(client.timeTracking.runningTimers()).resolves.toHaveLength(1);
});

test("an edit changes the project, the note and the start, and null clears project and note", async () => {
  const { client, clock } = await start();
  const project = await client.projects.create({ title: "Website" });
  const { timer } = await client.timeTracking.startTimer({});
  clock.advance(60_000);

  const edited = {
    ...timer,
    startedAt: "2026-11-16T08:45:10.000Z",
    projectId: project.id,
    note: "Design",
  };
  await expect(
    client.timeTracking.editTimer({
      id: timer.id,
      startedAt: "2026-11-16T08:45:10.812Z",
      projectId: project.id,
      note: " Design ",
    }),
  ).resolves.toEqual(edited);
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { ...edited, project: { id: project.id, title: "Website" } },
  ]);

  const cleared = { ...edited, projectId: null, note: null };
  await expect(
    client.timeTracking.editTimer({ id: timer.id, projectId: null, note: null }),
  ).resolves.toEqual(cleared);
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([
    { ...cleared, project: null },
  ]);
});

test("a start after the Data Process's now is an input error at the start and changes nothing", async () => {
  const { client } = await start();
  const { timer } = await client.timeTracking.startTimer({ note: "Design" });

  // The same second as now, cut, is no start in the future.
  await expect(
    client.timeTracking.editTimer({ id: timer.id, startedAt: "2026-11-16T09:00:00.900Z" }),
  ).resolves.toEqual(timer);
  for (const startedAt of ["2026-11-16T09:00:01.000Z", "2026-11-17T09:00:00.000Z"]) {
    await expect(
      errorOf(client.timeTracking.editTimer({ id: timer.id, startedAt, note: "Build" })),
    ).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ path: ["startedAt"], params: { reason: "start_in_future" } }] },
    });
  }
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([{ ...timer, project: null }]);
});

test("an edit without fields answers the timer and sends no Table Change", async () => {
  const { client } = await start();
  const { timer } = await client.timeTracking.startTimer({ note: "Design" });

  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });
  await expect(client.timeTracking.editTimer({ id: timer.id })).resolves.toEqual(timer);
  // A write to a different table marks how far the stream has advanced.
  await client.projects.create({ title: "Garden" });
  await expect(events.next()).resolves.toMatchObject({
    value: { kind: "changed", tables: ["projects"] },
  });
  await events.return?.();
});

test("discard removes the timer from the Query and writes no time entry", async () => {
  const { client, clock } = await start();
  const { timer } = await client.timeTracking.startTimer({ note: "Design" });
  clock.advance(3_600_000);

  await expect(client.timeTracking.discardTimer({ id: timer.id })).resolves.toEqual(timer);
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);
  await expect(
    client.timeTracking.days({ span: { first: "2026-11-16", last: "2026-11-16" } }),
  ).resolves.toMatchObject({ days: [{ entries: [] }] });
  for (const call of [
    client.timeTracking.discardTimer({ id: timer.id }),
    client.timeTracking.editTimer({ id: timer.id }),
  ])
    await expect(errorOf(call)).resolves.toMatchObject({ code: "NOT_FOUND", defined: true });
});

test("a project with a running timer is not deleted, and the Refusal names the timers", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website" });
  await client.timeTracking.startTimer({ projectId: project.id });

  const error = await errorOf(client.projects.delete({ id: project.id }));

  expect(error.code).toBe("REFUSED");
  expect(error.data?.reasons).toEqual([
    {
      code: "referenced",
      severity: "blocking",
      table: "projects",
      row: project.id,
      details: { tables: [{ table: "timers", count: 1 }] },
    },
  ]);
  await expect(client.projects.archive({ id: project.id })).resolves.toMatchObject({
    id: project.id,
  });
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { projectId: project.id, project: { archivedAt: expect.any(String), deletedAt: null } },
  ]);
});

test("an archived project is accepted at start, a deleted or unknown one is refused at the project", async () => {
  const { client } = await start();
  const archived = await client.projects.create({ title: "Archived" });
  await client.projects.archive({ id: archived.id });
  const deleted = await client.projects.create({ title: "Deleted" });
  await client.projects.delete({ id: deleted.id });
  const unknown = projectIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");

  await expect(client.timeTracking.startTimer({ projectId: archived.id })).resolves.toMatchObject({
    timer: { projectId: archived.id },
  });
  for (const projectId of [deleted.id, unknown]) {
    const error = await errorOf(client.timeTracking.startTimer({ projectId }));
    expect(error.code).toBe("REFUSED");
    expect(error.data?.reasons).toEqual([
      expect.objectContaining({
        code: "target_deleted",
        table: "timers",
        field: "project_id",
        details: { target: { table: "projects", id: projectId } },
      }),
    ]);
  }
  await expect(client.timeTracking.runningTimers()).resolves.toHaveLength(1);
});

test("two running timers written into the database are both returned, the most recently started first", async () => {
  const { client, process } = await start();
  const project = await client.projects.create({ title: "Website" });
  const { timer: first } = await client.timeTracking.startTimer({ note: "On this device" });
  const rows = process.database.kysely.withTables<{
    timers: Record<string, string | null>;
  }>();
  const [stored] = await rows.selectFrom("timers").selectAll().execute();
  // As a sync would bring it: a timer another device started a minute earlier, and arrived later.
  const other = {
    id: "01a1cfa1-0b00-7000-8000-0000000000aa",
    startedAt: "2026-11-16T08:59:00.000Z",
  };
  await rows
    .insertInto("timers")
    .values({
      ...stored,
      id: other.id,
      started_at: other.startedAt,
      project_id: project.id,
      note: "On another device",
    })
    .execute();

  await expect(client.timeTracking.runningTimers()).resolves.toEqual([
    { ...first, project: null },
    {
      id: other.id,
      startedAt: other.startedAt,
      projectId: project.id,
      note: "On another device",
      project: expect.objectContaining({ id: project.id, title: "Website" }),
    },
  ]);
});

test("stop answers with the saved entry: the timer's id, start, project and note, the end cut to the second", async () => {
  const { client, clock, process, saveTimeZone } = await start();
  const project = await client.projects.create({ title: "Website" });
  const { timer } = await client.timeTracking.startTimer({ projectId: project.id, note: "Design" });
  clock.advance(90 * 60_000 + 700);
  await saveTimeZone("Asia/Bangkok");

  const answer = await client.timeTracking.stopTimer({ id: timer.id });

  const entry = {
    id: timer.id,
    startedAt: "2026-11-16T09:00:00.000Z",
    endedAt: "2026-11-16T10:30:00.000Z",
    durationSeconds: 5400,
    projectId: project.id,
    note: "Design",
  };
  expect(answer).toEqual({ kind: "saved", entry });
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);
  await expect(
    client.timeTracking.entry({ id: timeEntryIdOfTimer(timer.id) }),
  ).resolves.toMatchObject(entry);
  // The zone of the Setting at the moment of stopping (D342).
  await expect(storedEntries(process, timer.id)).resolves.toEqual([
    { id: timer.id, time_zone: "Asia/Bangkok", deleted_at: null },
  ]);
});

/** The day of the tests, as `days` answers its entries. */
const dayEntries = async (client: Awaited<ReturnType<typeof start>>["client"]) =>
  (await client.timeTracking.days({ span: { first: "2026-11-16", last: "2026-11-16" } })).days[0]
    ?.entries;

test("stop announces one Table Change naming both tables; stopping again answers the same entry and announces nothing", async () => {
  const { client, clock, process } = await start();
  const { timer } = await client.timeTracking.startTimer({ note: "Design" });
  clock.advance(60_000);

  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });
  const first = await client.timeTracking.stopTimer({ id: timer.id });
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["time_entries", "timers"] },
  });

  // A double click, or a later stop at another moment: the same entry, nothing written.
  clock.advance(60_000);
  await expect(client.timeTracking.stopTimer({ id: timer.id })).resolves.toEqual(first);
  await expect(
    client.timeTracking.stopTimer({ id: timer.id, endedAt: "2026-11-16T09:00:30.000Z" }),
  ).resolves.toEqual(first);
  // A write to a different table marks how far the stream has advanced.
  await client.projects.create({ title: "Garden" });
  await expect(events.next()).resolves.toMatchObject({
    value: { kind: "changed", tables: ["projects"] },
  });
  await events.return?.();
  await expect(storedEntries(process, timer.id)).resolves.toHaveLength(1);
  await expect(dayEntries(client)).resolves.toHaveLength(1);
});

test("stopping a discarded or an unknown timer is not found", async () => {
  const { client, clock } = await start();
  const { timer } = await client.timeTracking.startTimer({});
  clock.advance(60_000);
  await client.timeTracking.discardTimer({ id: timer.id });
  const unknown = timerIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");

  for (const id of [timer.id, unknown])
    await expect(errorOf(client.timeTracking.stopTimer({ id }))).resolves.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  await expect(dayEntries(client)).resolves.toEqual([]);
});

test("a stop within the second of the start discards the timer, saves no entry and says so", async () => {
  const { client, clock, process } = await start();
  const { timer } = await client.timeTracking.startTimer({ note: "Slip" });
  clock.advance(600);

  await expect(client.timeTracking.stopTimer({ id: timer.id })).resolves.toEqual({
    kind: "discarded",
    timer,
  });
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);
  await expect(storedEntries(process, timer.id)).resolves.toEqual([]);
  // A discarded timer stays discarded.
  await expect(errorOf(client.timeTracking.stopTimer({ id: timer.id }))).resolves.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("stop at an end between the start and now writes that end, cut to the second", async () => {
  const { client, clock } = await start();
  const { timer } = await client.timeTracking.startTimer({});
  clock.advance(8 * 3_600_000);

  await expect(
    client.timeTracking.stopTimer({ id: timer.id, endedAt: "2026-11-16T09:00:01.999Z" }),
  ).resolves.toEqual({
    kind: "saved",
    entry: expect.objectContaining({
      startedAt: "2026-11-16T09:00:00.000Z",
      endedAt: "2026-11-16T09:00:01.000Z",
      durationSeconds: 1,
    }),
  });
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);
});

test("stop at an end not after the start or after now is an input error at the end and writes nothing", async () => {
  const { client, clock } = await start();
  const { timer } = await client.timeTracking.startTimer({});
  clock.advance(3_600_000);

  for (const [endedAt, reason] of [
    ["2026-11-16T08:59:59.000Z", "end_before_start"],
    // Within the start's second: the end must lie a whole second after it (D344).
    ["2026-11-16T09:00:00.900Z", "end_before_start"],
    ["2026-11-16T10:00:01.000Z", "end_in_future"],
  ] as const)
    await expect(
      errorOf(client.timeTracking.stopTimer({ id: timer.id, endedAt })),
    ).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ path: ["endedAt"], params: { reason } }] },
    });
  // Now's own second, cut, is no end in the future.
  await expect(
    client.timeTracking.stopTimer({ id: timer.id, endedAt: "2026-11-16T10:00:00.400Z" }),
  ).resolves.toMatchObject({ kind: "saved", entry: { endedAt: "2026-11-16T10:00:00.000Z" } });
});

test("with the clock before the timer's start, stop writes nothing, the timer runs on and the answer says why", async () => {
  const { client, clock, process } = await start();
  const { timer } = await client.timeTracking.startTimer({ note: "Design" });
  // The computer's clock jumped back.
  clock.advance(-3_600_000);

  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });
  await expect(client.timeTracking.stopTimer({ id: timer.id })).resolves.toEqual({
    kind: "clockBeforeStart",
    timer,
  });
  await client.projects.create({ title: "Garden" });
  await expect(events.next()).resolves.toMatchObject({
    value: { kind: "changed", tables: ["projects"] },
  });
  await events.return?.();
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([{ ...timer, project: null }]);
  await expect(storedEntries(process, timer.id)).resolves.toEqual([]);
});

test("a caller tells the three answers of stop apart, and the compiler holds it to all three", async () => {
  const { client, clock } = await start();
  const { timer } = await client.timeTracking.startTimer({});
  clock.advance(1_000);

  // As a Notice would: a fourth kind added to the answer fails to compile here.
  const notice = (stop: TimerStop) => {
    switch (stop.kind) {
      case "saved":
        return `saved ${stop.entry.durationSeconds}s`;
      case "discarded":
        return "nothing saved";
      case "clockBeforeStart":
        return "stop at";
      default:
        return stop satisfies never;
    }
  };
  expect(notice(await client.timeTracking.stopTimer({ id: timer.id }))).toBe("saved 1s");
});

test("start stops the running timer into its entry in the same transaction and names it; one timer runs", async () => {
  const { client, clock } = await start();
  const project = await client.projects.create({ title: "Website" });
  const { timer: first } = await client.timeTracking.startTimer({ projectId: project.id });
  clock.advance(30 * 60_000);

  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });
  const { timer: second, others } = await client.timeTracking.startTimer({ note: "Mail" });
  await expect(events.next()).resolves.toMatchObject({
    value: { kind: "changed", tables: ["time_entries", "timers"] },
  });
  await events.return?.();

  expect(others).toEqual([
    {
      kind: "saved",
      entry: {
        id: first.id,
        startedAt: "2026-11-16T09:00:00.000Z",
        endedAt: "2026-11-16T09:30:00.000Z",
        durationSeconds: 1800,
        projectId: project.id,
        note: null,
      },
    },
  ]);
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([
    { ...second, startedAt: "2026-11-16T09:30:00.000Z", project: null },
  ]);
  // The stopped timer stays stopped, with its entry.
  await expect(client.timeTracking.stopTimer({ id: first.id })).resolves.toEqual(others[0]);
});

test("start stops every running timer by the rules of stop: an entry, a discard, or one left running before its start", async () => {
  const { client, clock, process } = await start();
  const { timer: mine } = await client.timeTracking.startTimer({ note: "On this device" });
  const rows = process.database.kysely.withTables<{ timers: Record<string, string | null> }>();
  const [stored] = await rows.selectFrom("timers").selectAll().execute();
  // As a sync would bring them: one started earlier, one whose start lies after this device's now.
  const ids = {
    earlier: "01a1cfa1-0b00-7000-8000-0000000000aa",
    later: "01a1cfa1-0b00-7000-8000-0000000000bb",
  };
  await rows
    .insertInto("timers")
    .values([
      { ...stored, id: ids.earlier, started_at: "2026-11-16T08:00:00.000Z", note: "Earlier" },
      { ...stored, id: ids.later, started_at: "2026-11-16T10:00:00.000Z", note: "Later" },
    ])
    .execute();
  clock.advance(400);

  const { timer, others } = await client.timeTracking.startTimer({});

  expect(others).toEqual([
    { kind: "clockBeforeStart", timer: expect.objectContaining({ id: ids.later }) },
    { kind: "discarded", timer: mine },
    {
      kind: "saved",
      entry: expect.objectContaining({ id: ids.earlier, durationSeconds: 3600, note: "Earlier" }),
    },
  ]);
  // The one before its start runs on: no entry with a wrong end is saved (D349).
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { id: ids.later },
    { id: timer.id },
  ]);
});

test("a timer whose project was archived meanwhile stops into an entry of the archived project", async () => {
  const { client, clock } = await start();
  const project = await client.projects.create({ title: "Website" });
  const { timer } = await client.timeTracking.startTimer({ projectId: project.id });
  clock.advance(60_000);
  await client.projects.archive({ id: project.id });

  await expect(client.timeTracking.stopTimer({ id: timer.id })).resolves.toMatchObject({
    kind: "saved",
    entry: { id: timer.id, projectId: project.id },
  });
});

test("undo stop removes the entry from the week and the timer runs with its original start, in one Table Change", async () => {
  const { client, clock } = await start();
  const project = await client.projects.create({ title: "Website" });
  const { timer } = await client.timeTracking.startTimer({ projectId: project.id, note: "Design" });
  clock.advance(30 * 60_000);
  await client.timeTracking.stopTimer({ id: timer.id });
  clock.advance(5_000);

  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });
  await expect(client.timeTracking.undoStopTimer({ id: timer.id })).resolves.toEqual({
    kind: "restored",
    timer,
    others: [],
  });
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["time_entries", "timers"] },
  });
  await events.return?.();

  await expect(dayEntries(client)).resolves.toEqual([]);
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { ...timer, startedAt: "2026-11-16T09:00:00.000Z" },
  ]);
});
