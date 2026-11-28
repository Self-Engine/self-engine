// A time entry through the Port of the test Data Process, as a View, a Command or an assistant
// calls it: `projects` and `time-tracking` mounted, with `settings` to save the Time Zone as the
// settings area does, and a fixed Clock.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type {
  ContractRouterClient,
  InferContractRouterOutputs,
  InferSchemaOutput,
} from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { type ProjectId, projectIdSchema } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { type Instant, resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { type TimeEntryId, timeEntryIdSchema, timeTrackingContract } from "./contracts/index.ts";
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

test("validated edits carry both Instants or neither, and Operation answers keep their brands", () => {
  type CheckedEdit = InferSchemaOutput<
    NonNullable<(typeof timeTrackingContract.edit)["~orpc"]["inputSchema"]>
  >;
  expectTypeOf<Extract<CheckedEdit, { startedAt: Instant }>["endedAt"]>().toEqualTypeOf<Instant>();
  expectTypeOf<Extract<CheckedEdit, { endedAt: Instant }>["startedAt"]>().toEqualTypeOf<Instant>();

  type Outputs = InferContractRouterOutputs<typeof timeTrackingContract>;
  expectTypeOf<
    Pick<Outputs["edit" | "delete" | "restore"], "id" | "startedAt" | "endedAt">
  >().toEqualTypeOf<{
    id: TimeEntryId;
    startedAt: Instant;
    endedAt: Instant;
  }>();
  expectTypeOf<
    Outputs["edit" | "delete" | "restore"]["projects"][number]["projectId"]
  >().toEqualTypeOf<ProjectId>();
});

test("editing only the note preserves both Instants, the Booked Duration and the creation Time Zone", async () => {
  const { client, saveTimeZone, storedTimeZone } = await start();
  await saveTimeZone("Asia/Bangkok");
  const created = await client.timeTracking.create({
    startedAt: "2026-11-16T10:00:50.000Z",
    endedAt: "2026-11-16T10:05:10.000Z",
    note: "Draft",
  });
  await saveTimeZone("America/Los_Angeles");
  const expected = { ...created, note: "Review" };

  await expect(client.timeTracking.edit({ id: created.id, note: " Review " })).resolves.toEqual(
    expected,
  );
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual({
    ...expected,
  });
  await expect(storedTimeZone(created.id)).resolves.toEqual(["Asia/Bangkok"]);
});

test("editing the time range stores whole seconds and rounds again with the entry's rule", async () => {
  const { client, saveTimeZone, storedTimeZone } = await start();
  const created = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    note: "Design",
  });
  await saveTimeZone("Asia/Bangkok");
  const expected = {
    ...created,
    startedAt: "2026-11-16T11:00:23.000Z",
    endedAt: "2026-11-16T11:05:03.000Z",
    // 4:40 measured, rounded up to the minute.
    roundedTime: { start: "2026-11-16T11:00:00.000Z", end: "2026-11-16T11:05:00.000Z" },
    bookedDuration: 300,
  };

  await expect(
    client.timeTracking.edit({
      id: created.id,
      startedAt: "2026-11-16T11:00:23.297Z",
      endedAt: "2026-11-16T11:05:03.812Z",
    }),
  ).resolves.toEqual(expected);
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual({
    ...expected,
  });
  await expect(storedTimeZone(created.id)).resolves.toEqual(["Europe/Berlin"]);
});

test("an edit with only one Instant, an invalid range or an unknown field changes nothing", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create({ startedAt: START, endedAt: END });
  const { id } = created;
  for (const fields of [{ startedAt: START }, { endedAt: END }]) {
    await expect(errorOf(client.timeTracking.edit({ id, ...fields }))).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ params: { reason: "start_and_end_together" } }] },
    });
  }
  const badRange = {
    id,
    startedAt: "2026-11-16T10:00:00.100Z",
    endedAt: "2026-11-16T10:00:00.900Z",
  };
  await expect(errorOf(client.timeTracking.edit(badRange))).resolves.toMatchObject({
    code: "BAD_REQUEST",
    data: { issues: [{ path: ["endedAt"], params: { reason: "end_before_start" } }] },
  });
  for (const field of ["notes", "bookedDuration", "timeZone"]) {
    const input = { id, [field]: "unexpected" };
    await expect(errorOf(client.timeTracking.edit(input))).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ code: "unrecognized_keys", keys: [field] }] },
    });
  }
  await expect(client.timeTracking.entry({ id })).resolves.toEqual(created);
});

test("deleting an entry returns it and removes it from the Query", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create({ startedAt: START, endedAt: END });
  const { id } = created;

  await expect(client.timeTracking.delete({ id })).resolves.toEqual(created);
  await expect(client.timeTracking.entry({ id })).resolves.toBeNull();
  await expect(errorOf(client.timeTracking.edit({ id }))).resolves.toMatchObject({
    code: "NOT_FOUND",
    defined: true,
  });
  await expect(errorOf(client.timeTracking.delete({ id }))).resolves.toMatchObject({
    code: "NOT_FOUND",
    defined: true,
  });
});

test("restore brings an entry back as it was", async () => {
  const { client, saveTimeZone, storedTimeZone } = await start();
  await saveTimeZone("Asia/Bangkok");
  const project = await client.projects.create({ title: "Website", icon: "house", color: "teal" });
  const created = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    projects: [{ projectId: project.id }],
    note: "Design",
  });
  const { id } = created;
  const before = await client.timeTracking.entry({ id });
  await client.timeTracking.delete({ id });
  await saveTimeZone("America/Los_Angeles");

  await expect(client.timeTracking.restore({ id })).resolves.toEqual(created);
  await expect(client.timeTracking.entry({ id })).resolves.toEqual(before);
  await expect(storedTimeZone(id)).resolves.toEqual(["Asia/Bangkok"]);
  await expect(errorOf(client.timeTracking.restore({ id }))).resolves.toMatchObject({
    code: "NOT_FOUND",
    defined: true,
  });
});

test("restore is refused when the project was deleted and succeeds after the project is restored", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website" });
  const created = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    projects: [{ projectId: project.id }],
  });
  const { id } = created;
  await client.timeTracking.delete({ id });
  await client.projects.delete({ id: project.id });

  await expect(errorOf(client.timeTracking.restore({ id }))).resolves.toMatchObject({
    code: "REFUSED",
    defined: true,
    data: {
      reasons: [
        {
          code: "target_deleted",
          severity: "blocking",
          table: "time_entries",
          row: id,
          field: "project_shares",
          details: { target: { table: "projects", id: project.id } },
        },
      ],
    },
  });
  await expect(client.timeTracking.entry({ id })).resolves.toBeNull();

  await client.projects.restore({ id: project.id });
  await expect(client.timeTracking.restore({ id })).resolves.toEqual(created);
});

test("the empty list removes the projects, null clears the note, and an edit without fields sends no Table Change", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website" });
  const created = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    projects: [{ projectId: project.id }],
    note: "Design",
  });
  const { id } = created;
  const cleared = { ...created, projects: [], note: null };

  await expect(client.timeTracking.edit({ id, projects: [], note: null })).resolves.toEqual(
    cleared,
  );
  await expect(client.timeTracking.entry({ id })).resolves.toEqual(cleared);

  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });
  await expect(client.timeTracking.edit({ id })).resolves.toEqual(cleared);
  // A write to a different table marks how far the stream has advanced.
  await client.projects.create({ title: "Garden" });
  await expect(events.next()).resolves.toMatchObject({
    value: { kind: "changed", tables: ["projects"] },
  });
  await events.return?.();
});

test("editing an entry on an archived project succeeds, while assigning a deleted project is refused", async () => {
  const { client } = await start();
  const archived = await client.projects.create({ title: "Archived" });
  const deleted = await client.projects.create({ title: "Deleted" });
  const created = await client.timeTracking.create({ startedAt: START, endedAt: END });
  const { id } = created;
  await client.projects.archive({ id: archived.id });
  await client.projects.delete({ id: deleted.id });

  const onArchived = [{ projectId: archived.id, weight: 1, projectShare: 5400 }];
  await expect(
    client.timeTracking.edit({ id, projects: [{ projectId: archived.id }] }),
  ).resolves.toEqual({ ...created, projects: onArchived });
  await expect(client.timeTracking.edit({ id, note: "Review" })).resolves.toEqual({
    ...created,
    projects: onArchived,
    note: "Review",
  });
  await expect(
    errorOf(client.timeTracking.edit({ id, projects: [{ projectId: deleted.id }] })),
  ).resolves.toMatchObject({
    code: "REFUSED",
    defined: true,
    data: {
      reasons: [
        {
          code: "target_deleted",
          severity: "blocking",
          table: "project_shares",
          row: expect.any(String),
          field: "project_id",
          details: { target: { table: "projects", id: deleted.id } },
        },
      ],
    },
  });
  await expect(client.timeTracking.entry({ id })).resolves.toMatchObject({
    note: "Review",
    projects: [
      {
        projectId: archived.id,
        project: { id: archived.id, archivedAt: expect.any(String), deletedAt: null },
      },
    ],
  });
});

test("create answers with the entry, and the Query returns it with its Project Reference", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website", icon: "house", color: "teal" });

  const created = await client.timeTracking.create({
    startedAt: START,
    endedAt: END,
    projects: [{ projectId: project.id }],
    note: " Design review ",
  });

  expect(created).toEqual({
    id: expect.any(String),
    startedAt: START,
    endedAt: END,
    roundedTime: { start: START, end: END },
    bookedDuration: 5400,
    roundingRule: { kind: "ordinary", direction: "up", minutes: 1 },
    ruleByHand: null,
    findings: [],
    breaks: [],
    projects: [{ projectId: project.id, weight: 1, projectShare: 5400 }],
    note: "Design review",
  });
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual({
    ...created,
    projects: [
      {
        projectId: project.id,
        weight: 1,
        projectShare: 5400,
        project: {
          id: project.id,
          title: "Website",
          icon: "house",
          color: "teal",
          archivedAt: null,
          deletedAt: null,
        },
      },
    ],
  });
});

test("an entry without a project or a note is created, and the Query gives no Project Reference", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create({ startedAt: START, endedAt: END });
  expect(created).toMatchObject({ projects: [], note: null });
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual(created);
  // A note of spaces is no note.
  await expect(
    client.timeTracking.create({ startedAt: START, endedAt: END, projects: [], note: "  " }),
  ).resolves.toMatchObject({ projects: [], note: null });
});

test("the Query answers an unknown id with no entry", async () => {
  const { client } = await start();
  const unknown = timeEntryIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");
  await expect(client.timeTracking.entry({ id: unknown })).resolves.toBeNull();
});

test("start and end with milliseconds are stored cut to the whole second, and the default rule rounds up to the minute", async () => {
  const { client } = await start();
  // D344's example: 10:00:50.297 to 10:05:10.812 measures 4:20, which counts 0:05.
  const created = await client.timeTracking.create({
    startedAt: "2026-11-16T10:00:50.297Z",
    endedAt: "2026-11-16T10:05:10.812Z",
  });
  const stored = {
    startedAt: "2026-11-16T10:00:50.000Z",
    endedAt: "2026-11-16T10:05:10.000Z",
    roundedTime: { start: "2026-11-16T10:00:00.000Z", end: "2026-11-16T10:05:00.000Z" },
    bookedDuration: 300,
  };
  expect(created).toMatchObject(stored);
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject(stored);
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
  ).resolves.toMatchObject({ bookedDuration: 60 });
  await expect(client.health()).resolves.toMatchObject({ state: "ready" });
});

test("the Booked Duration is the time that really passed, rounded, and an input that names a computed value is an input error", async () => {
  const { client } = await start();
  // Across midnight and a whole day: 28:00:15 passed, which counts 28:01.
  await expect(
    client.timeTracking.create({
      startedAt: "2026-11-15T21:00:00.000Z",
      endedAt: "2026-11-17T01:00:15.000Z",
    }),
  ).resolves.toMatchObject({ bookedDuration: 100_860 });
  for (const named of [
    { bookedDuration: 60 },
    { duration: 60 },
    { duration_seconds: 60 },
    { roundedTime: { start: START, end: END } },
    { roundingRule: { kind: "exact" } },
  ]) {
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
    projects: [{ projectId: archived.id }],
  });
  await expect(client.timeTracking.entry({ id: late.id })).resolves.toMatchObject({
    projects: [
      {
        projectId: archived.id,
        project: { id: archived.id, archivedAt: expect.any(String), deletedAt: null },
      },
    ],
  });
  for (const projectId of [deleted.id, unknown]) {
    const error = await errorOf(
      client.timeTracking.create({ startedAt: START, endedAt: END, projects: [{ projectId }] }),
    );
    expect(error.code).toBe("REFUSED");
    expect(error.data?.reasons).toEqual([
      expect.objectContaining({
        code: "target_deleted",
        table: "project_shares",
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
      projects: [{ projectId: project.id }],
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
