// The breaks of a Work Entry through the Port of the test Data Process, as a View, a Command or an
// assistant calls it (ADR 0044): the Operation checks the list on every write and refuses a broken
// rule with a named Reason at the break; it never cuts, moves or deletes a break on its own.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { createTestSources } from "@self-engine/db/testing";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { instantSchema, resolveTimeZone } from "@self-engine/time";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  type Break,
  BREAK_NOT_BETWEEN_WORK,
  BREAK_OVERLAPS,
  BREAK_TOO_SHORT,
  BREAKS_UNKNOWN,
  type RoundingRule,
  ROUNDING_RULE_UNKNOWN,
} from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

/** The test Data Process with `projects`, `time-tracking` and `settings`, and the Clock it reads. */
async function start() {
  const sources = createTestSources("2026-11-16T14:00:00.000Z");
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
  /**
   * Writes the breaks of a stored row as another device, a sync or a restored backup could: no
   * Operation of this version writes such a list.
   */
  async function storeAsElsewhere(id: string, breaks: string) {
    await process.database.kysely
      .withTables<{ time_entries: { id: string; breaks: string } }>()
      .updateTable("time_entries")
      .set({ breaks })
      .where("id", "=", id)
      .execute();
  }
  return { client, clock: sources, storeAsElsewhere };
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

/** The input error a call is refused with: one Reason at one break. */
const refusedAt = (index: number, reason: string) => ({
  code: "BAD_REQUEST",
  data: { issues: [{ path: ["breaks", index], params: { reason } }] },
});

const minutes = (count: number) => count * 60;
const at = (clock: string) => `2026-11-16T${clock}.000Z`;
const instant = (clock: string) => instantSchema.parse(at(clock));
const restBreak = (from: string, to: string): Extract<Break, { timeKind: "rest_break" }> => ({
  timeKind: "rest_break",
  startedAt: instant(from),
  endedAt: instant(to),
  changedByLimit: false,
});
const shortBreak = (from: string, to: string): Break => ({
  timeKind: "short_break",
  startedAt: instant(from),
  endedAt: instant(to),
});
const UP_15: RoundingRule = { kind: "ordinary", direction: "up", minutes: 15 };
// The rounding resolution's entry: 9:00:10 – 12:40:20, a Rest Break of 20:25 inside.
const EXAMPLE = {
  startedAt: at("09:00:10"),
  endedAt: at("12:40:20"),
  breaks: [restBreak("10:30:00", "10:50:25")],
};

test("the rounding resolution's example from create to the Query: 9:00 – 12:40, work 3:20", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create(EXAMPLE);
  const expected = {
    roundedTime: { start: at("09:00:00"), end: at("12:40:00") },
    bookedDuration: minutes(200),
    breaks: EXAMPLE.breaks,
    findings: [],
  };
  expect(created).toMatchObject(expected);
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject(expected);
  const week = await client.timeTracking.days({
    span: { first: "2026-11-16", last: "2026-11-22" },
  });
  expect(week.days[0]?.entries).toMatchObject([{ id: created.id, dayShare: minutes(200) }]);
  expect(week.total).toBe(minutes(200));
});

test("a break holds its Time Kind, its start and end on whole seconds, and the mark of the limit", async () => {
  const { client } = await start();
  const marked: Break = { ...restBreak("10:00:00", "10:30:00"), changedByLimit: true };
  const created = await client.timeTracking.create({
    startedAt: at("09:00:00"),
    endedAt: at("12:00:00"),
    breaks: [
      {
        ...shortBreak("09:30:00", "09:40:00"),
        startedAt: instantSchema.parse("2026-11-16T09:30:00.700Z"),
      },
      marked,
    ],
  });
  expect(created.breaks).toEqual([shortBreak("09:30:00", "09:40:00"), marked]);
  // A Short Break counts; the Rest Break does not.
  expect(created.bookedDuration).toBe(minutes(150));
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject({
    breaks: created.breaks,
  });
});

test("an entry made without breaks has none, and so has the entry of a stopped Timer", async () => {
  const { client, clock } = await start();
  await expect(
    client.timeTracking.create({ startedAt: at("09:00:00"), endedAt: at("10:00:00") }),
  ).resolves.toMatchObject({ breaks: [] });
  const { timer } = await client.timeTracking.startTimer({});
  clock.advance(minutes(30) * 1000);
  const stop = await client.timeTracking.stopTimer({ id: timer.id });
  expect(stop).toMatchObject({ kind: "saved", entry: { breaks: [] } });
});

describe("create refuses a broken rule and names the break", () => {
  const entry = { startedAt: at("09:00:00"), endedAt: at("12:00:00") };
  test.each<[string, Break[], number, string]>([
    ["a break at the start", [restBreak("09:00:00", "09:30:00")], 0, BREAK_NOT_BETWEEN_WORK],
    [
      "a break at the end",
      [restBreak("10:00:00", "10:30:00"), shortBreak("11:30:00", "12:00:00")],
      1,
      BREAK_NOT_BETWEEN_WORK,
    ],
    ["a break outside", [restBreak("13:00:00", "13:30:00")], 0, BREAK_NOT_BETWEEN_WORK],
    [
      "overlapping breaks",
      [restBreak("10:00:00", "10:30:00"), shortBreak("10:29:59", "10:40:00")],
      1,
      BREAK_OVERLAPS,
    ],
    ["a break shorter than a second", [restBreak("10:00:00", "10:00:00")], 0, BREAK_TOO_SHORT],
  ])("%s", async (_name, breaks, index, reason) => {
    const { client } = await start();
    await expect(errorOf(client.timeTracking.create({ ...entry, breaks }))).resolves.toMatchObject(
      refusedAt(index, reason),
    );
    const week = await client.timeTracking.days({
      span: { first: "2026-11-16", last: "2026-11-22" },
    });
    expect(week.total).toBe(0);
  });

  test("breaks that touch are kept as two", async () => {
    const { client } = await start();
    const breaks = [restBreak("10:00:00", "10:30:00"), shortBreak("10:30:00", "10:40:00")];
    await expect(client.timeTracking.create({ ...entry, breaks })).resolves.toMatchObject({
      breaks,
      bookedDuration: minutes(150),
    });
  });
});

describe("edit", () => {
  test("replaces the list as a whole, and an edit of another field leaves it as it is", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create(EXAMPLE);
    await expect(client.timeTracking.edit({ id, note: "Review" })).resolves.toMatchObject({
      breaks: EXAMPLE.breaks,
      bookedDuration: minutes(200),
      note: "Review",
    });
    const replaced = [shortBreak("10:00:00", "10:10:00"), restBreak("11:00:00", "11:30:00")];
    await expect(client.timeTracking.edit({ id, breaks: replaced })).resolves.toMatchObject({
      breaks: replaced,
      roundedTime: { start: at("09:00:00"), end: at("12:41:00") },
      bookedDuration: minutes(191),
    });
    await expect(client.timeTracking.edit({ id, breaks: [] })).resolves.toMatchObject({
      breaks: [],
      bookedDuration: minutes(221),
    });
  });

  test("refuses a list that breaks a rule, and keeps the stored one", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create(EXAMPLE);
    await expect(
      errorOf(
        client.timeTracking.edit({
          id,
          breaks: [restBreak("10:00:00", "10:30:00"), restBreak("10:10:00", "10:20:00")],
        }),
      ),
    ).resolves.toMatchObject(refusedAt(1, BREAK_OVERLAPS));
    await expect(client.timeTracking.entry({ id })).resolves.toMatchObject({
      breaks: EXAMPLE.breaks,
    });
  });

  test("refuses a start or end that leaves a break no longer between Work, and names the break", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create({
      startedAt: at("09:00:00"),
      endedAt: at("12:00:00"),
      breaks: [shortBreak("09:30:00", "09:40:00"), restBreak("11:00:00", "11:30:00")],
    });
    await expect(
      errorOf(client.timeTracking.edit({ id, startedAt: at("09:00:00"), endedAt: at("11:30:00") })),
    ).resolves.toMatchObject(refusedAt(1, BREAK_NOT_BETWEEN_WORK));
    await expect(
      errorOf(client.timeTracking.edit({ id, startedAt: at("09:35:00"), endedAt: at("12:00:00") })),
    ).resolves.toMatchObject(refusedAt(0, BREAK_NOT_BETWEEN_WORK));
    // Neither the entry nor a break changed.
    await expect(client.timeTracking.entry({ id })).resolves.toMatchObject({
      startedAt: at("09:00:00"),
      endedAt: at("12:00:00"),
      breaks: [shortBreak("09:30:00", "09:40:00"), restBreak("11:00:00", "11:30:00")],
    });
  });
});

describe("move", () => {
  test("shifts start, end and every break by the same amount and rounds with the entry's own rule", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create({ ...EXAMPLE, ruleByHand: UP_15 });
    // Back by 1:30:05, onto 7:30:05.
    await expect(
      client.timeTracking.move({ id, startedAt: at("07:30:05") }),
    ).resolves.toMatchObject({
      startedAt: at("07:30:05"),
      endedAt: at("11:10:15"),
      breaks: [restBreak("08:59:55", "09:20:20")],
      roundedTime: { start: at("07:30:00"), end: at("11:20:00") },
      bookedDuration: minutes(210),
      roundingRule: UP_15,
      ruleByHand: UP_15,
    });
    // Forward again, onto the minute after 9:00.
    await expect(
      client.timeTracking.move({ id, startedAt: at("09:01:10") }),
    ).resolves.toMatchObject({
      startedAt: at("09:01:10"),
      endedAt: at("12:41:20"),
      breaks: [restBreak("10:31:00", "10:51:25")],
    });
  });

  test("is refused for an entry whose stored rule this version cannot read", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create(EXAMPLE);
    await startedRowWith(id, '{"kind":"minimum","minutes":30}');
    await expect(
      errorOf(client.timeTracking.move({ id, startedAt: at("08:00:00") })),
    ).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ path: ["ruleByHand"], params: { reason: ROUNDING_RULE_UNKNOWN } }] },
    });

    async function startedRowWith(entryId: string, rule: string) {
      const process = started.at(-1)!;
      await process.database.kysely
        .withTables<{ time_entries: { id: string; rounding_rule: string } }>()
        .updateTable("time_entries")
        .set({ rounding_rule: rule })
        .where("id", "=", entryId)
        .execute();
    }
  });

  test("an unknown or deleted entry is not found", async () => {
    const { client } = await start();
    const { id } = await client.timeTracking.create(EXAMPLE);
    await client.timeTracking.delete({ id });
    await expect(
      errorOf(client.timeTracking.move({ id, startedAt: at("08:00:00") })),
    ).resolves.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("reading is lenient", () => {
  test("an entry whose stored breaks break the rules is answered with its stored numbers and a mark", async () => {
    const { client, storeAsElsewhere } = await start();
    const created = await client.timeTracking.create(EXAMPLE);
    const broken = [restBreak("08:00:00", "09:30:00"), shortBreak("09:20:00", "09:40:00")];
    await storeAsElsewhere(created.id, JSON.stringify(broken));
    await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject({
      roundedTime: created.roundedTime,
      bookedDuration: created.bookedDuration,
      breaks: broken,
      findings: [
        { reason: BREAK_NOT_BETWEEN_WORK, breakIndex: 0 },
        { reason: BREAK_OVERLAPS, breakIndex: 1 },
      ],
    });
    // An edit that keeps the list is refused at the first broken break; one that repairs it saves.
    await expect(
      errorOf(client.timeTracking.edit({ id: created.id, note: "Review" })),
    ).resolves.toMatchObject(refusedAt(0, BREAK_NOT_BETWEEN_WORK));
    await expect(
      client.timeTracking.edit({ id: created.id, breaks: [broken[1]!] }),
    ).resolves.toMatchObject({ findings: [], bookedDuration: minutes(221) });
  });

  test("breaks this version cannot read are answered as null, and an edit that keeps them is refused", async () => {
    const { client, storeAsElsewhere } = await start();
    const created = await client.timeTracking.create(EXAMPLE);
    // A later version's kind of stretch.
    await storeAsElsewhere(
      created.id,
      '[{"timeKind":"focus","startedAt":"2026-11-16T10:00:00.000Z","endedAt":"2026-11-16T10:30:00.000Z"}]',
    );
    await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject({
      bookedDuration: created.bookedDuration,
      breaks: null,
    });
    await expect(
      errorOf(client.timeTracking.edit({ id: created.id, note: "Review" })),
    ).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ path: ["breaks"], params: { reason: BREAKS_UNKNOWN } }] },
    });
    await expect(client.timeTracking.edit({ id: created.id, breaks: [] })).resolves.toMatchObject({
      breaks: [],
    });
  });

  test("the table keeps the breaks readable: text that is no JSON array is refused", async () => {
    const { client, storeAsElsewhere } = await start();
    const { id } = await client.timeTracking.create(EXAMPLE);
    await expect(storeAsElsewhere(id, "not json")).rejects.toThrow();
    await expect(storeAsElsewhere(id, '{"timeKind":"rest_break"}')).rejects.toThrow();
  });
});
