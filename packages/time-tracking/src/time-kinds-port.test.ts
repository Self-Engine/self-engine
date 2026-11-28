// The Time Kind of a Time Entry through the Port of the test Data Process, as a View, a Command or
// an assistant calls it (ADR 0044): a Work Entry carries breaks and projects, an entry that is not
// work neither; every entry has a Rounded Time, and what counts follows from its kind.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { createTestSources } from "@self-engine/db/testing";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone } from "@self-engine/time";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  NOT_WORK_HAS_BREAKS,
  NOT_WORK_HAS_PROJECTS,
  NOT_WORK_HAS_RULE_BY_HAND,
  type RoundingRule,
} from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

type Tables = {
  time_entries: { id: string; breaks: string; time_kind: string; changed_by_limit: number };
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
};

/** The test Data Process with `projects`, `time-tracking` and `settings` in Berlin (UTC+1). */
async function start() {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    sources: createTestSources("2026-11-16T20:00:00.000Z"),
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
  const database = process.database.kysely.withTables<Tables>();
  /** Writes a row as another device, a sync or a restored backup could. */
  const storeAsElsewhere = (id: string, values: Partial<Tables["time_entries"]>) =>
    database.updateTable("time_entries").set(values).where("id", "=", id).execute();
  /** Seeds a Rounding Rule: no Operation of this version writes one. */
  const seedRule = (id: string, project: string | null, rule: RoundingRule) =>
    database
      .insertInto("rounding_rules")
      .values((eb) => ({
        id,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
        space_id: eb.selectFrom("spaces").select("id").limit(1),
        project_id: project,
        holds_from: null,
        rounding_rule: JSON.stringify(rule),
      }))
      .execute();
  return { client, storeAsElsewhere, seedRule };
}

/** The error a call answers with. */
async function errorOf(call: Promise<unknown>) {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeDefined();
  return error as { code: string; data?: { issues?: unknown[] } };
}

/** The input error a call is refused with: one Reason at one field. */
const refusedAt = (field: string, reason: string) => ({
  code: "BAD_REQUEST",
  data: { issues: [expect.objectContaining({ path: [field], params: { reason } })] },
});

/** A time on Monday 16 November 2026 in Berlin, as an Instant. */
const at = (clock: string) => {
  const [hours = 0, minutes = 0, seconds = 0] = clock.split(":").map(Number);
  const utc = `${String(hours - 1).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `2026-11-16T${utc}.000Z`;
};

const minutes = (count: number) => count * 60;
const UP_15: RoundingRule = { kind: "ordinary", direction: "up", minutes: 15 };
const EXACT: RoundingRule = { kind: "exact" };
const ruleId = (n: number) => `01a1cfa1-0e00-7000-8000-${String(n).padStart(12, "0")}`;

describe("create", () => {
  test("the rounding resolution's Leisure Entry, 14:00:10 – 16:44:20, counts as 14:00 – 16:45 and books nothing", async () => {
    const { client } = await start();
    const entry = await client.timeTracking.create({
      timeKind: "leisure",
      startedAt: at("14:00:10"),
      endedAt: at("16:44:20"),
      note: "Afternoon off",
    });
    expect(entry).toEqual({
      id: expect.any(String),
      timeKind: "leisure",
      startedAt: at("14:00:10"),
      endedAt: at("16:44:20"),
      roundedTime: { start: at("14:00"), end: at("16:45") },
      bookedDuration: 0,
      findings: [],
      note: "Afternoon off",
    });
    expect(await client.timeTracking.entry({ id: entry.id })).toEqual(entry);
  });

  test("a Short Break books the length of its Rounded Time; a Rest Break books nothing and carries the mark 'changed by the limit', off", async () => {
    const { client } = await start();
    const short = await client.timeTracking.create({
      timeKind: "short_break",
      startedAt: at("10:00:10"),
      endedAt: at("10:12:20"),
    });
    expect(short).toMatchObject({
      roundedTime: { start: at("10:00"), end: at("10:13") },
      bookedDuration: minutes(13),
    });
    const rest = await client.timeTracking.create({
      timeKind: "rest_break",
      startedAt: at("12:00:00"),
      endedAt: at("12:30:00"),
    });
    expect(rest).toMatchObject({ bookedDuration: 0, changedByLimit: false });
  });

  test("without a Time Kind an entry is a Work Entry", async () => {
    const { client } = await start();
    const entry = await client.timeTracking.create({
      startedAt: at("09:00"),
      endedAt: at("10:00"),
    });
    expect(entry).toMatchObject({ timeKind: "work", projects: [], breaks: [] });
  });

  test("an entry that is not work takes the app-wide rule, never its project's", async () => {
    const { client, seedRule } = await start();
    const website = await client.projects.create({ title: "Website" });
    await seedRule(ruleId(1), website.id, EXACT);
    await seedRule(ruleId(2), null, UP_15);
    const entry = await client.timeTracking.create({
      timeKind: "short_break",
      startedAt: at("10:00:10"),
      endedAt: at("10:12:20"),
    });
    expect(entry).toMatchObject({
      roundedTime: { start: at("10:00"), end: at("10:15") },
      bookedDuration: minutes(15),
    });
  });

  test("projects or breaks on an entry that is not work are refused with a named Reason", async () => {
    const { client } = await start();
    const website = await client.projects.create({ title: "Website" });
    const leisure = { timeKind: "leisure", startedAt: at("14:00"), endedAt: at("16:00") } as const;
    // The input type has neither field for an entry that is not work; a caller without types can
    // still send them.
    const untyped = (input: object) =>
      client.timeTracking.create(input as Parameters<typeof client.timeTracking.create>[0]);
    expect(
      await errorOf(untyped({ ...leisure, projects: [{ projectId: website.id }] })),
    ).toMatchObject(refusedAt("projects", NOT_WORK_HAS_PROJECTS));
    expect(
      await errorOf(
        untyped({
          ...leisure,
          breaks: [{ timeKind: "short_break", startedAt: at("15:00"), endedAt: at("15:10") }],
        }),
      ),
    ).toMatchObject(refusedAt("breaks", NOT_WORK_HAS_BREAKS));
    // The empty lists say "none".
    await expect(
      client.timeTracking.create({ ...leisure, projects: [], breaks: [] }),
    ).resolves.toMatchObject({ timeKind: "leisure" });
  });
});

describe("the Time Kind of an edit", () => {
  const entryOf = <Kind extends "work" | "short_break" | "rest_break" | "leisure">(
    timeKind: Kind,
  ) => ({
    timeKind,
    startedAt: at("14:00:10"),
    endedAt: at("16:44:20"),
  });

  test("changes freely between Short Break, Rest Break and Leisure, and from those to Work", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create(entryOf("leisure"));
    await expect(client.timeTracking.edit({ id, timeKind: "short_break" })).resolves.toMatchObject({
      timeKind: "short_break",
      bookedDuration: minutes(165),
    });
    await expect(client.timeTracking.edit({ id, timeKind: "rest_break" })).resolves.toMatchObject({
      timeKind: "rest_break",
      bookedDuration: 0,
      changedByLimit: false,
    });
    await expect(client.timeTracking.edit({ id, timeKind: "leisure" })).resolves.toMatchObject({
      timeKind: "leisure",
    });
    await expect(client.timeTracking.edit({ id, timeKind: "work" })).resolves.toMatchObject({
      timeKind: "work",
      roundedTime: { start: at("14:00"), end: at("16:45") },
      bookedDuration: minutes(165),
      roundingRule: { kind: "ordinary", direction: "up", minutes: 1 },
      ruleByHand: null,
      breaks: [],
      projects: [],
    });
  });

  test("to Work with projects it keeps its rule; 'look up again' in the same edit takes the Lead Project's", async () => {
    const { client, seedRule } = await start();
    const website = await client.projects.create({ title: "Website" });
    await seedRule(ruleId(1), website.id, UP_15);
    const kept = await client.timeTracking.create(entryOf("leisure"));
    await expect(
      client.timeTracking.edit({
        id: kept.id,
        timeKind: "work",
        projects: [{ projectId: website.id }],
      }),
    ).resolves.toMatchObject({
      timeKind: "work",
      roundingRule: { kind: "ordinary", direction: "up", minutes: 1 },
      ruleByHand: null,
      projects: [{ projectId: website.id, weight: 1 }],
    });

    const lookedUp = await client.timeTracking.create(entryOf("leisure"));
    await expect(
      client.timeTracking.edit({
        id: lookedUp.id,
        timeKind: "work",
        projects: [{ projectId: website.id }],
        ruleByHand: null,
      }),
    ).resolves.toMatchObject({
      timeKind: "work",
      roundingRule: UP_15,
      bookedDuration: minutes(165),
      projects: [{ projectId: website.id, weight: 1, projectShare: minutes(165) }],
    });
  });

  test("from Work to one that is not work only without projects and breaks; the app-wide rule then rounds it", async () => {
    const { client } = await start();
    const website = await client.projects.create({ title: "Website" });
    const withProject = await client.timeTracking.create({
      ...entryOf("work"),
      projects: [{ projectId: website.id }],
    });
    expect(
      await errorOf(client.timeTracking.edit({ id: withProject.id, timeKind: "leisure" })),
    ).toMatchObject(refusedAt("projects", NOT_WORK_HAS_PROJECTS));
    await expect(
      client.timeTracking.edit({ id: withProject.id, timeKind: "leisure", projects: [] }),
    ).resolves.toMatchObject({ timeKind: "leisure", bookedDuration: 0 });

    const withBreak = await client.timeTracking.create({
      ...entryOf("work"),
      breaks: [{ timeKind: "short_break", startedAt: at("15:00"), endedAt: at("15:10") }],
    });
    expect(
      await errorOf(client.timeTracking.edit({ id: withBreak.id, timeKind: "rest_break" })),
    ).toMatchObject(refusedAt("breaks", NOT_WORK_HAS_BREAKS));

  });

  test("from Work to one that is not work it takes the app-wide rule that held at its start and loses the mark 'chosen by hand'; back to Work it keeps that rule", async () => {
    const { client, seedRule } = await start();
    await seedRule(ruleId(1), null, UP_15);
    const byHand = await client.timeTracking.create({ ...entryOf("work"), ruleByHand: EXACT });
    await expect(
      client.timeTracking.edit({ id: byHand.id, timeKind: "short_break" }),
    ).resolves.toMatchObject({
      roundedTime: { start: at("14:00"), end: at("16:45") },
      bookedDuration: minutes(165),
    });
    // An answer that is not work carries no rule: back to Work shows the one it took.
    await expect(
      client.timeTracking.edit({ id: byHand.id, timeKind: "work" }),
    ).resolves.toMatchObject({ roundingRule: UP_15, ruleByHand: null });
  });

  test("an edit of an entry that is not work refuses projects, breaks and a rule chosen by hand", async () => {
    const { client } = await start();
    const website = await client.projects.create({ title: "Website" });
    const { id } = await client.timeTracking.create(entryOf("leisure"));
    expect(
      await errorOf(client.timeTracking.edit({ id, projects: [{ projectId: website.id }] })),
    ).toMatchObject(refusedAt("projects", NOT_WORK_HAS_PROJECTS));
    expect(
      await errorOf(
        client.timeTracking.edit({
          id,
          breaks: [{ timeKind: "short_break", startedAt: at("15:00"), endedAt: at("15:10") }],
        }),
      ),
    ).toMatchObject(refusedAt("breaks", NOT_WORK_HAS_BREAKS));
    expect(await errorOf(client.timeTracking.edit({ id, ruleByHand: EXACT }))).toMatchObject(
      refusedAt("ruleByHand", NOT_WORK_HAS_RULE_BY_HAND),
    );
  });

  test("an edit of other fields leaves the Time Kind as it is, and a move keeps it", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create(entryOf("short_break"));
    await expect(
      client.timeTracking.edit({
        id,
        note: "Coffee",
        startedAt: at("14:00"),
        endedAt: at("14:20"),
      }),
    ).resolves.toMatchObject({
      timeKind: "short_break",
      note: "Coffee",
      bookedDuration: minutes(20),
    });
    await expect(client.timeTracking.move({ id, startedAt: at("15:00") })).resolves.toMatchObject({
      timeKind: "short_break",
      roundedTime: { start: at("15:00"), end: at("15:20") },
    });
  });
});

describe("the mark 'changed by the limit' of a Rest Break entry", () => {
  test("is stored and answered; an edit keeps it while the kind stays, and a change of kind removes it", async () => {
    const { client, storeAsElsewhere } = await start();
    const { id } = await client.timeTracking.create({
      timeKind: "rest_break",
      startedAt: at("12:00"),
      endedAt: at("12:30"),
    });
    // Nothing of this version sets the mark yet: the limit of a Short Break does, later.
    await storeAsElsewhere(id, { changed_by_limit: 1 });
    await expect(client.timeTracking.entry({ id })).resolves.toMatchObject({
      changedByLimit: true,
    });
    await expect(client.timeTracking.edit({ id, note: "Lunch" })).resolves.toMatchObject({
      changedByLimit: true,
    });
    await client.timeTracking.edit({ id, timeKind: "short_break" });
    await expect(client.timeTracking.edit({ id, timeKind: "rest_break" })).resolves.toMatchObject({
      changedByLimit: false,
    });
  });

  test("the database refuses it on any other kind", async () => {
    const { client, storeAsElsewhere } = await start();
    const { id } = await client.timeTracking.create({
      timeKind: "short_break",
      startedAt: at("12:00"),
      endedAt: at("12:10"),
    });
    await expect(storeAsElsewhere(id, { changed_by_limit: 1 })).rejects.toThrow(/CHECK/);
  });
});

describe("the database", () => {
  test("checks the four Time Kinds and refuses a list of breaks on an entry that is not work", async () => {
    const { client, storeAsElsewhere } = await start();
    const { id } = await client.timeTracking.create({
      timeKind: "leisure",
      startedAt: at("14:00"),
      endedAt: at("16:00"),
    });
    await expect(storeAsElsewhere(id, { time_kind: "focus" })).rejects.toThrow(/CHECK/);
    const breaks = JSON.stringify([
      { timeKind: "short_break", startedAt: at("15:00"), endedAt: at("15:10") },
    ]);
    await expect(storeAsElsewhere(id, { breaks })).rejects.toThrow(/CHECK/);
    const work = await client.timeTracking.create({ startedAt: at("09:00"), endedAt: at("12:00") });
    await expect(storeAsElsewhere(work.id, { breaks })).resolves.toBeDefined();
  });
});

describe("the Day Span", () => {
  test("a day's total adds Booked Durations: a Short Break counts toward the day and no project, a Rest Break and Leisure add nothing", async () => {
    const { client } = await start();
    const website = await client.projects.create({ title: "Website" });
    const work = await client.timeTracking.create({
      startedAt: at("09:00"),
      endedAt: at("10:00"),
      projects: [{ projectId: website.id }],
    });
    const short = await client.timeTracking.create({
      timeKind: "short_break",
      startedAt: at("10:00"),
      endedAt: at("10:15"),
    });
    const rest = await client.timeTracking.create({
      timeKind: "rest_break",
      startedAt: at("12:00"),
      endedAt: at("12:30"),
    });
    const leisure = await client.timeTracking.create({
      timeKind: "leisure",
      startedAt: at("14:00:10"),
      endedAt: at("16:44:20"),
    });
    const answer = await client.timeTracking.days({
      span: { first: "2026-11-16", last: "2026-11-16" },
    });
    expect(answer.total).toBe(minutes(75));
    expect(answer.days[0]?.total).toBe(minutes(75));
    expect(
      answer.days[0]?.entries.map(({ id, timeKind, roundedTime, bookedDuration, dayShare }) => ({
        id,
        timeKind,
        roundedTime,
        bookedDuration,
        dayShare,
      })),
    ).toEqual([
      {
        id: work.id,
        timeKind: "work",
        roundedTime: { start: at("09:00"), end: at("10:00") },
        bookedDuration: minutes(60),
        dayShare: minutes(60),
      },
      {
        id: short.id,
        timeKind: "short_break",
        roundedTime: { start: at("10:00"), end: at("10:15") },
        bookedDuration: minutes(15),
        dayShare: minutes(15),
      },
      {
        id: rest.id,
        timeKind: "rest_break",
        roundedTime: { start: at("12:00"), end: at("12:30") },
        bookedDuration: 0,
        dayShare: 0,
      },
      {
        id: leisure.id,
        timeKind: "leisure",
        roundedTime: { start: at("14:00"), end: at("16:45") },
        bookedDuration: 0,
        dayShare: 0,
      },
    ]);
    expect(answer.projects).toEqual([
      { project: expect.objectContaining({ id: website.id }), total: minutes(60) },
      { project: null, total: minutes(15) },
    ]);
  });

  test("Leisure across midnight adds nothing to either day", async () => {
    const { client } = await start();
    await client.timeTracking.create({
      timeKind: "leisure",
      startedAt: "2026-11-16T21:00:00.000Z",
      endedAt: "2026-11-17T01:00:00.000Z",
    });
    const answer = await client.timeTracking.days({
      span: { first: "2026-11-16", last: "2026-11-17" },
    });
    expect(
      answer.days.map(({ total, entries }) => [total, entries.map((e) => e.dayShare)]),
    ).toEqual([
      [0, [0]],
      [0, [0]],
    ]);
    expect(answer.projects).toEqual([]);
  });
});

test("stopping a Timer writes a Work Entry", async () => {
  const { client } = await start();
  const { timer } = await client.timeTracking.startTimer({});
  await client.timeTracking.editTimer({ id: timer.id, startedAt: "2026-11-16T19:00:00.000Z" });
  const stopped = await client.timeTracking.stopTimer({ id: timer.id });
  expect(stopped).toMatchObject({ kind: "saved", entry: { timeKind: "work" } });
});
