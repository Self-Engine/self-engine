// A time entry through the Port of the test Data Process, as a View, a Command or an assistant
// calls it: `projects` and `time-tracking` mounted, with `settings` to save the Time Zone as the
// settings area does, and a fixed Clock.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projectIdSchema } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, test } from "vite-plus/test";
import { timeEntryIdSchema } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

const NEW_YORK = resolveTimeZone("America/New_York").timeZone;

/** The test Data Process with both modules; the device runs in Berlin unless a test says else. */
async function start({ deviceZone = resolveTimeZone("Europe/Berlin").timeZone } = {}) {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    deviceZone,
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
  /** The zone name a row stores: no answer carries it, layer 4 never reads it (D342). */
  async function storedTimeZone(id: string) {
    const rows = await process.database.kysely
      .withTables<{ time_entries: { id: string; time_zone: string } }>()
      .selectFrom("time_entries")
      .select("time_zone")
      .where("id", "=", id)
      .execute();
    return rows.map((row) => row.time_zone);
  }
  return { process, client, saveTimeZone, storedTimeZone };
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

const START = "2026-11-16T09:00:00.000Z";
const END = "2026-11-16T10:30:00.000Z";

test("create answers with the entry, and the Query returns it with its Project Reference", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website", icon: "house", color: "teal" });

  const created = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    projectId: project.id,
    note: " Design review ",
  });

  expect(created).toEqual({
    id: expect.any(String),
    startedAt: START,
    endedAt: END,
    durationSeconds: 5400,
    projectId: project.id,
    note: "Design review",
  });
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual({
    ...created,
    project: {
      id: project.id,
      title: "Website",
      icon: "house",
      color: "teal",
      archivedAt: null,
      deletedAt: null,
    },
  });
});

test("an entry without a project or a note is created, and the Query gives no Project Reference", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create({ startedAt: START, endedAt: END });
  expect(created).toMatchObject({ projectId: null, note: null });
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual({
    ...created,
    project: null,
  });
  // A note of spaces is no note.
  await expect(
    client.timeTracking.create({ startedAt: START, endedAt: END, projectId: null, note: "  " }),
  ).resolves.toMatchObject({ projectId: null, note: null });
});

test("the Query answers an unknown id with no entry", async () => {
  const { client } = await start();
  const unknown = timeEntryIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");
  await expect(client.timeTracking.entry({ id: unknown })).resolves.toBeNull();
});

test("start and end with milliseconds are stored cut to the whole second", async () => {
  const { client } = await start();
  // D344's example: 10:00:50.297 to 10:05:10.812 counts 4:20.
  const created = await client.timeTracking.create({
    startedAt: "2026-11-16T10:00:50.297Z",
    endedAt: "2026-11-16T10:05:10.812Z",
  });
  expect(created).toMatchObject({
    startedAt: "2026-11-16T10:00:50.000Z",
    endedAt: "2026-11-16T10:05:10.000Z",
    durationSeconds: 260,
  });
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject({
    startedAt: "2026-11-16T10:00:50.000Z",
    endedAt: "2026-11-16T10:05:10.000Z",
    durationSeconds: 260,
  });
});

test("an end less than one second after the start, cut to the second, is an input error at the end", async () => {
  const { client } = await start();
  for (const [startedAt, endedAt] of [
    // 800 ms apart, but both in the same second once cut.
    ["2026-11-16T10:00:00.100Z", "2026-11-16T10:00:00.900Z"],
    [START, START],
    [END, START],
  ] as const) {
    const error = await errorOf(client.timeTracking.create({ startedAt, endedAt }));
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.data?.issues).toEqual([
      expect.objectContaining({ path: ["endedAt"], params: { reason: "end_before_start" } }),
    ]);
  }
  // 200 ms apart across a second's border: one whole second once cut.
  await expect(
    client.timeTracking.create({
      startedAt: "2026-11-16T10:00:00.900Z",
      endedAt: "2026-11-16T10:00:01.100Z",
    }),
  ).resolves.toMatchObject({ durationSeconds: 1 });
  await expect(client.health()).resolves.toMatchObject({ state: "ready" });
});

test("the duration is end minus start, and an input that names a duration is an input error", async () => {
  const { client } = await start();
  // Across midnight and a whole day: the time that really passed.
  await expect(
    client.timeTracking.create({
      startedAt: "2026-11-15T21:00:00.000Z",
      endedAt: "2026-11-17T01:00:15.000Z",
    }),
  ).resolves.toMatchObject({ durationSeconds: 100_815 });
  for (const named of [{ durationSeconds: 60 }, { duration: 60 }, { duration_seconds: 60 }]) {
    // The Operation's types refuse these inputs; a caller without types can still send them.
    const input = { startedAt: START, endedAt: END, ...named } as {
      startedAt: string;
      endedAt: string;
    };
    await expect(errorOf(client.timeTracking.create(input))).resolves.toMatchObject({
      code: "BAD_REQUEST",
    });
  }
});

test("the row stores the Time Zone of the Setting, and after a change a new entry stores the new name", async () => {
  const { client, saveTimeZone, storedTimeZone } = await start();
  await saveTimeZone("Asia/Bangkok");
  const first = await client.timeTracking.create({ startedAt: START, endedAt: END });
  await saveTimeZone("America/Los_Angeles");
  const second = await client.timeTracking.create({ startedAt: START, endedAt: END });

  await expect(storedTimeZone(first.id)).resolves.toEqual(["Asia/Bangkok"]);
  await expect(storedTimeZone(second.id)).resolves.toEqual(["America/Los_Angeles"]);
});

test("the stored name keeps the spelling it was chosen in", async () => {
  const { client, saveTimeZone, storedTimeZone } = await start();
  await saveTimeZone("Asia/Calcutta");
  const created = await client.timeTracking.create({ startedAt: START, endedAt: END });
  await expect(storedTimeZone(created.id)).resolves.toEqual(["Asia/Calcutta"]);
});

test("without a Time Zone, or with one this runtime does not know, the row stores the device's zone", async () => {
  const { client, saveTimeZone, storedTimeZone } = await start({ deviceZone: NEW_YORK });
  const unset = await client.timeTracking.create({ startedAt: START, endedAt: END });
  await saveTimeZone("Mars/Olympus_Mons");
  const unknown = await client.timeTracking.create({ startedAt: START, endedAt: END });

  await expect(storedTimeZone(unset.id)).resolves.toEqual(["America/New_York"]);
  await expect(storedTimeZone(unknown.id)).resolves.toEqual(["America/New_York"]);
});

test("an archived project is accepted, a deleted or unknown one is refused at the project field", async () => {
  const { client } = await start();
  const archived = await client.projects.create({ title: "Archived" });
  await client.projects.archive({ id: archived.id });
  const deleted = await client.projects.create({ title: "Deleted" });
  await client.projects.delete({ id: deleted.id });
  const unknown = projectIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");

  const late = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    projectId: archived.id,
  });
  await expect(client.timeTracking.entry({ id: late.id })).resolves.toMatchObject({
    projectId: archived.id,
    project: { id: archived.id, archivedAt: expect.any(String), deletedAt: null },
  });
  for (const projectId of [deleted.id, unknown]) {
    const error = await errorOf(
      client.timeTracking.create({ startedAt: START, endedAt: END, projectId }),
    );
    expect(error.code).toBe("REFUSED");
    expect(error.data?.reasons).toEqual([
      expect.objectContaining({
        code: "target_deleted",
        table: "time_entries",
        field: "project_id",
        details: { target: { table: "projects", id: projectId } },
      }),
    ]);
  }
});

test("a project with a live time entry is not deleted, and the Refusal counts the time entries", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website" });
  for (const note of ["Design", "Build"])
    await client.timeTracking.create({
      startedAt: START,
      endedAt: END,
      projectId: project.id,
      note,
    });

  const error = await errorOf(client.projects.delete({ id: project.id }));

  expect(error.code).toBe("REFUSED");
  expect(error.data?.reasons).toEqual([
    {
      code: "referenced",
      severity: "blocking",
      table: "projects",
      row: project.id,
      details: { tables: [{ table: "time_entries", count: 2 }] },
    },
  ]);
  await expect(client.projects.archive({ id: project.id })).resolves.toMatchObject({
    id: project.id,
  });
});
