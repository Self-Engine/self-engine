// The projects of a Time Entry are Project Shares, through the Port of the test Data Process:
// `projects`, `time-tracking` and `settings` mounted, real migrations and a fixed Clock. The
// examples are the tables of the resolution "Several projects on one Time Entry" (#404).

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import type { ProjectId } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  PROJECT_NAMED_TWICE,
  type RoundingRule,
  timeEntryIdOfTimer,
  WEIGHT_OUT_OF_RANGE,
} from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";
import { asWorkEntry } from "./testing/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

const minutes = (value: number) => value * 60;

/**
 * The test Data Process in Berlin on 20 April 2026, with every statement that reads the table of
 * Project Shares recorded.
 */
async function start() {
  const raw = openDatabase(":memory:");
  const shareReads: string[] = [];
  const kysely = raw.kysely.withPlugin({
    transformQuery({ node, queryId }) {
      const { sql } = raw.kysely.getExecutor().compileQuery(node, queryId);
      if (/^\s*select/i.test(sql) && /\bfrom "project_shares"/.test(sql)) shareReads.push(sql);
      return node;
    },
    transformResult: async ({ result }) => result,
  });
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    database: { ...raw, kysely },
    sources: createTestSources("2026-04-20T10:00:00.000Z"),
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

  const project = async (title: string) => (await client.projects.create({ title })).id;

  /** Writes a project's rule directly: no Operation of this version writes one (#422). */
  async function seedRule(projectId: ProjectId, rule: RoundingRule) {
    await raw.kysely
      .withTables<{
        rounding_rules: {
          id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          space_id: string;
          project_id: string | null;
          holds_from: string | null;
          rounding_rule: string;
        };
        spaces: { id: string };
      }>()
      .insertInto("rounding_rules")
      .values((eb) => ({
        id: `01a1cfa1-0e00-7000-8000-${projectId.slice(-12)}`,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
        space_id: eb.selectFrom("spaces").select("id").limit(1),
        project_id: projectId,
        holds_from: null,
        rounding_rule: JSON.stringify(rule),
      }))
      .execute();
  }

  /** The rows of shares of an entry, deleted ones too: what no answer shows. */
  async function storedShares(entryId: string) {
    return raw.kysely
      .withTables<{
        project_shares: {
          id: string;
          time_entry_id: string;
          project_id: string;
          created_at: string;
          deleted_at: string | null;
        };
      }>()
      .selectFrom("project_shares")
      .select(["id", "project_id", "deleted_at"])
      .where("time_entry_id", "=", entryId)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
  }

  return { client, project, seedRule, storedShares, shareReads };
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

const TIMER = { startedAt: "2026-04-14T08:07:30.000Z", endedAt: "2026-04-14T08:29:50.000Z" };
const HOUR = { startedAt: "2026-04-14T08:00:00.000Z", endedAt: "2026-04-14T09:00:00.000Z" };

test("the projects of an entry are an ordered list with the Lead Project first, each with its Weight and Project Share", async () => {
  const { client, project } = await start();
  const [a, b, c] = [await project("A"), await project("B"), await project("C")];

  const created = await client.timeTracking.create({
    ...TIMER,
    projects: [
      { projectId: a, weight: 50 },
      { projectId: b, weight: 30 },
      { projectId: c, weight: 20 },
    ],
  });

  // The third division of 0:23 in the resolution.
  expect(created).toMatchObject({
    bookedDuration: minutes(23),
    projects: [
      { projectId: a, weight: 50, projectShare: minutes(13) },
      { projectId: b, weight: 30, projectShare: minutes(6) },
      { projectId: c, weight: 20, projectShare: minutes(4) },
    ],
  });
  // The Query of one entry answers the Project Reference of each project.
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toEqual({
    ...created,
    projects: asWorkEntry(created).projects.map((share, index) => ({
      ...share,
      project: expect.objectContaining({ id: share.projectId, title: ["A", "B", "C"][index] }),
    })),
  });
});

test("without Weights the projects divide in equal parts, and without projects the list is empty", async () => {
  const { client, project } = await start();
  const [a, b, c] = [await project("A"), await project("B"), await project("C")];

  await expect(
    client.timeTracking.create({ ...TIMER, projects: [{ projectId: a }, { projectId: b }] }),
  ).resolves.toMatchObject({
    projects: [
      { projectId: a, weight: 1, projectShare: minutes(12) },
      { projectId: b, weight: 1, projectShare: minutes(11) },
    ],
  });
  await expect(
    client.timeTracking.create({
      ...TIMER,
      projects: [{ projectId: a }, { projectId: b }, { projectId: c }],
    }),
  ).resolves.toMatchObject({
    projects: [
      { projectShare: minutes(9) },
      { projectShare: minutes(7) },
      { projectShare: minutes(7) },
    ],
  });
  await expect(client.timeTracking.create(TIMER)).resolves.toMatchObject({
    bookedDuration: minutes(23),
    projects: [],
  });
});

test("a project named twice and a Weight outside its range are refused with named Reasons", async () => {
  const { client, project } = await start();
  const [a, b] = [await project("A"), await project("B")];

  const twice = await errorOf(
    client.timeTracking.create({
      ...TIMER,
      projects: [{ projectId: a }, { projectId: b }, { projectId: a }],
    }),
  );
  expect(twice.code).toBe("BAD_REQUEST");
  expect(twice.data?.issues).toEqual([
    expect.objectContaining({
      path: ["projects", 2, "projectId"],
      params: { reason: PROJECT_NAMED_TWICE },
    }),
  ]);
  for (const weight of [0, 10_001, 1.5]) {
    const created = await client.timeTracking.create(HOUR);
    const outside = await errorOf(
      client.timeTracking.edit({ id: created.id, projects: [{ projectId: a, weight }] }),
    );
    expect(outside.code).toBe("BAD_REQUEST");
    expect(outside.data?.issues).toEqual([
      expect.objectContaining({
        path: ["projects", 0, "weight"],
        params: { reason: WEIGHT_OUT_OF_RANGE },
      }),
    ]);
  }
  await expect(
    client.timeTracking.create({ ...HOUR, projects: [{ projectId: a, weight: 10_000 }] }),
  ).resolves.toMatchObject({ projects: [{ weight: 10_000, projectShare: minutes(60) }] });
});

test("the Lead Project gives the rule: A rounds up to 15 minutes, B is Exact", async () => {
  const { client, project, seedRule } = await start();
  const [a, b] = [await project("A"), await project("B")];
  await seedRule(a, { kind: "ordinary", direction: "up", minutes: 15 });
  await seedRule(b, { kind: "exact" });

  await expect(
    client.timeTracking.create({ ...TIMER, projects: [{ projectId: a }, { projectId: b }] }),
  ).resolves.toMatchObject({
    roundedTime: { start: "2026-04-14T08:07:00.000Z", end: "2026-04-14T08:37:00.000Z" },
    bookedDuration: minutes(30),
    projects: [{ projectShare: minutes(15) }, { projectShare: minutes(15) }],
  });
  await expect(
    client.timeTracking.create({ ...TIMER, projects: [{ projectId: b }, { projectId: a }] }),
  ).resolves.toMatchObject({
    roundedTime: { start: TIMER.startedAt, end: TIMER.endedAt },
    bookedDuration: minutes(22) + 20,
    projects: [{ projectShare: minutes(11) + 10 }, { projectShare: minutes(11) + 10 }],
  });

  // "Look up again" asks the Lead Project the edit leaves.
  const entry = await client.timeTracking.create({
    ...TIMER,
    projects: [{ projectId: a }, { projectId: b }],
  });
  await expect(
    client.timeTracking.edit({
      id: entry.id,
      projects: [{ projectId: b }, { projectId: a }],
      ruleByHand: null,
    }),
  ).resolves.toMatchObject({ roundingRule: { kind: "exact" }, bookedDuration: minutes(22) + 20 });
});

describe("the resolution's table of edits: 10:00 – 11:00 with A 50 %, B 30 %, C 20 %", () => {
  async function entryOfThree() {
    const started = await start();
    const { client, project } = started;
    const [a, b, c, d] = [
      await project("A"),
      await project("B"),
      await project("C"),
      await project("D"),
    ];
    const entry = await client.timeTracking.create({
      ...HOUR,
      projects: [
        { projectId: a, weight: 50 },
        { projectId: b, weight: 30 },
        { projectId: c, weight: 20 },
      ],
    });
    expect(asWorkEntry(entry).projects.map(({ projectShare }) => projectShare)).toEqual([
      minutes(30),
      minutes(18),
      minutes(12),
    ]);
    const counted = { roundedTime: entry.roundedTime, bookedDuration: minutes(60) };
    return { ...started, a, b, c, d, entry, counted };
  }

  test("removing C: A and B keep their ratio and divide the whole 1:00", async () => {
    const { client, a, b, entry, counted } = await entryOfThree();
    await expect(
      client.timeTracking.edit({
        id: entry.id,
        projects: [
          { projectId: a, weight: 50 },
          { projectId: b, weight: 30 },
        ],
      }),
    ).resolves.toMatchObject({
      ...counted,
      projects: [
        { projectId: a, projectShare: minutes(38) },
        { projectId: b, projectShare: minutes(22) },
      ],
    });
  });

  test("adding D: D gets a Weight, the others keep their ratio", async () => {
    const { client, a, b, c, d, entry, counted } = await entryOfThree();
    await expect(
      client.timeTracking.edit({
        id: entry.id,
        projects: [
          { projectId: a, weight: 50 },
          { projectId: b, weight: 30 },
          { projectId: c, weight: 20 },
          { projectId: d, weight: 100 },
        ],
      }),
    ).resolves.toMatchObject({
      ...counted,
      projects: [
        { projectId: a, projectShare: minutes(15) },
        { projectId: b, projectShare: minutes(9) },
        { projectId: c, projectShare: minutes(6) },
        { projectId: d, projectShare: minutes(30) },
      ],
    });
  });

  test("changing Weights changes only the Project Shares", async () => {
    const { client, a, b, c, entry, counted } = await entryOfThree();
    await expect(
      client.timeTracking.edit({
        id: entry.id,
        projects: [{ projectId: a }, { projectId: b }, { projectId: c }],
      }),
    ).resolves.toMatchObject({
      ...counted,
      projects: [
        { projectShare: minutes(20) },
        { projectShare: minutes(20) },
        { projectShare: minutes(20) },
      ],
    });
  });

  test("removing A, the Lead Project: B becomes the Lead Project and the entry keeps its rule", async () => {
    const { client, b, c, entry, counted, seedRule } = await entryOfThree();
    await seedRule(b, { kind: "exact" });
    await expect(
      client.timeTracking.edit({
        id: entry.id,
        projects: [
          { projectId: b, weight: 30 },
          { projectId: c, weight: 20 },
        ],
      }),
    ).resolves.toMatchObject({
      ...counted,
      roundingRule: asWorkEntry(entry).roundingRule,
      projects: [
        { projectId: b, projectShare: minutes(36) },
        { projectId: c, projectShare: minutes(24) },
      ],
    });
  });

  test("removing every project: the entry has none and still counts 1:00", async () => {
    const { client, entry, counted } = await entryOfThree();
    await expect(client.timeTracking.edit({ id: entry.id, projects: [] })).resolves.toMatchObject({
      ...counted,
      projects: [],
    });
    await expect(client.timeTracking.entry({ id: entry.id })).resolves.toMatchObject({
      ...counted,
      projects: [],
    });
  });

  test("an edit of other fields leaves the projects as they are, and one of the times divides again", async () => {
    const { client, entry } = await entryOfThree();
    await expect(client.timeTracking.edit({ id: entry.id, note: "Review" })).resolves.toEqual({
      ...entry,
      note: "Review",
    });
    await expect(
      client.timeTracking.edit({
        id: entry.id,
        startedAt: HOUR.startedAt,
        endedAt: "2026-04-14T08:30:00.000Z",
      }),
    ).resolves.toMatchObject({
      bookedDuration: minutes(30),
      projects: [
        { weight: 50, projectShare: minutes(15) },
        { weight: 30, projectShare: minutes(9) },
        { weight: 20, projectShare: minutes(6) },
      ],
    });
  });
});

test("removing a project soft-deletes its share, and adding it again makes a new row", async () => {
  const { client, project, storedShares } = await start();
  const [a, b] = [await project("A"), await project("B")];
  const entry = await client.timeTracking.create({
    ...HOUR,
    projects: [{ projectId: a }, { projectId: b }],
  });

  await client.timeTracking.edit({ id: entry.id, projects: [{ projectId: a }] });
  await client.timeTracking.edit({ id: entry.id, projects: [{ projectId: a }, { projectId: b }] });

  const rows = await storedShares(entry.id);
  expect(rows.map(({ project_id, deleted_at }) => [project_id, deleted_at !== null])).toEqual([
    [a, false],
    [b, true],
    [b, false],
  ]);
});

test("delete and restore change only the entry; a project is not deleted while a live entry has a share in it", async () => {
  const { client, project } = await start();
  const [a, b] = [await project("A"), await project("B")];
  const first = await client.timeTracking.create({
    ...HOUR,
    projects: [{ projectId: a }, { projectId: b }],
  });
  const second = await client.timeTracking.create({ ...TIMER, projects: [{ projectId: b }] });

  const referenced = await errorOf(client.projects.delete({ id: b }));
  expect(referenced.code).toBe("REFUSED");
  expect(referenced.data?.reasons).toEqual([
    expect.objectContaining({
      code: "referenced",
      details: { tables: [{ table: "time_entries", count: 2 }] },
    }),
  ]);

  await client.timeTracking.delete({ id: first.id });
  await client.timeTracking.delete({ id: second.id });
  await expect(client.projects.delete({ id: b })).resolves.toMatchObject({ id: b });

  const refused = await errorOf(client.timeTracking.restore({ id: first.id }));
  expect(refused.code).toBe("REFUSED");
  expect(refused.data?.reasons).toEqual([
    expect.objectContaining({
      code: "target_deleted",
      table: "time_entries",
      row: first.id,
      field: "project_shares",
      details: { target: { table: "projects", id: b } },
    }),
  ]);

  await client.projects.restore({ id: b });
  await expect(client.timeTracking.restore({ id: first.id })).resolves.toEqual(first);
});

test("stopping a Timer with a project writes one share that holds the whole Booked Duration, and undo works", async () => {
  const { client, project } = await start();
  const a = await project("A");
  const { timer } = await client.timeTracking.startTimer({ projectId: a });
  await client.timeTracking.editTimer({ id: timer.id, startedAt: "2026-04-20T09:15:20.000Z" });

  const stopped = await client.timeTracking.stopTimer({ id: timer.id });
  expect(stopped).toMatchObject({ kind: "saved" });
  const id = timeEntryIdOfTimer(timer.id);
  const entry = await client.timeTracking.entry({ id });
  expect(entry === null ? null : asWorkEntry(entry).projects).toEqual([
    expect.objectContaining({ projectId: a, weight: 1, projectShare: entry?.bookedDuration }),
  ]);

  await expect(client.timeTracking.undoStopTimer({ id: timer.id })).resolves.toMatchObject({
    kind: "restored",
  });
  await expect(client.timeTracking.entry({ id })).resolves.toBeNull();
});

describe("the Day Span reads the Project Shares", () => {
  const SPAN = { first: "2026-04-14", last: "2026-04-14" };

  // The resolution's day: 09:00 – 10:00 for A, and 10:00 – 10:30 for A and B in equal parts.
  async function day() {
    const started = await start();
    const { client, project } = started;
    const [a, b] = [await project("A"), await project("B")];
    await client.timeTracking.create({
      startedAt: "2026-04-14T07:00:00.000Z",
      endedAt: "2026-04-14T08:00:00.000Z",
      projects: [{ projectId: a }],
    });
    const shared = await client.timeTracking.create({
      startedAt: "2026-04-14T08:00:00.000Z",
      endedAt: "2026-04-14T08:30:00.000Z",
      projects: [{ projectId: a }, { projectId: b }],
    });
    const none = await client.timeTracking.create({
      startedAt: "2026-04-14T09:00:00.000Z",
      endedAt: "2026-04-14T09:10:00.000Z",
    });
    return { ...started, a, b, shared, none };
  }

  const sums = (answer: {
    projects: readonly { project: { id: string } | null; total: number }[];
  }) => answer.projects.map(({ project, total }) => [project?.id ?? null, total]);

  test("the sums per project add up to the total of the entries that have a project", async () => {
    const { client, a, b } = await day();
    const answer = await client.timeTracking.days({ span: SPAN });
    expect(sums(answer)).toEqual([
      [a, minutes(75)],
      [b, minutes(15)],
      [null, minutes(10)],
    ]);
    expect(answer.total).toBe(minutes(100));
    expect(answer.days[0]?.entries.map((entry) => asWorkEntry(entry).projects.length)).toEqual([
      1, 2, 0,
    ]);
  });

  test("the filter by project holds the entries with a share in it and counts that share; 'no project' holds those without one", async () => {
    const { client, b, shared, none } = await day();
    const onB = await client.timeTracking.days({
      span: SPAN,
      filter: { kind: "project", projectId: b },
    });
    expect(onB.days[0]?.entries.map(({ id }) => id)).toEqual([shared.id]);
    expect(sums(onB)).toEqual([[b, minutes(15)]]);
    expect(onB.days[0]?.total).toBe(minutes(15));

    const without = await client.timeTracking.days({ span: SPAN, filter: { kind: "noProject" } });
    expect(without.days[0]?.entries.map(({ id }) => id)).toEqual([none.id]);
    expect(sums(without)).toEqual([[null, minutes(10)]]);
  });

  test("the shares of a deleted entry are not counted", async () => {
    const { client, a, shared } = await day();
    await client.timeTracking.delete({ id: shared.id });
    const answer = await client.timeTracking.days({ span: SPAN });
    expect(sums(answer)).toEqual([
      [a, minutes(60)],
      [null, minutes(10)],
    ]);
  });

  test("a span costs one read of the shares of its entries, not one per entry", async () => {
    const { client, shareReads } = await day();
    shareReads.splice(0);
    await client.timeTracking.days({ span: SPAN });
    expect(shareReads).toHaveLength(1);
  });
});

test("moving an entry keeps its projects and divides its Booked Duration again", async () => {
  const { client, project } = await start();
  const [a, b] = [await project("A"), await project("B")];
  const entry = await client.timeTracking.create({
    ...TIMER,
    projects: [{ projectId: a }, { projectId: b, weight: 3 }],
  });

  // 08:07:30 to 08:29:50 moved by 30 seconds: 22:20 from 08:08:00 still counts 0:23.
  await expect(
    client.timeTracking.move({ id: entry.id, startedAt: "2026-04-14T08:08:00.000Z" }),
  ).resolves.toMatchObject({
    bookedDuration: minutes(23),
    projects: [
      { projectId: a, weight: 1, projectShare: minutes(6) },
      { projectId: b, weight: 3, projectShare: minutes(17) },
    ],
  });
});
