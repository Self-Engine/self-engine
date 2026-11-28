// The rounding of a Time Entry through the Port of the test Data Process, as a View, a Command or
// an assistant calls it (ADR 0044): every write computes the Rounded Time and the Booked Duration
// with the entry's Rounding Rule; nothing computed is an input.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  DEFAULT_ROUNDING_RULE,
  type RoundingRule,
  ROUNDING_RULE_UNKNOWN,
  TIME_ZONE_UNKNOWN,
} from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

/** The test Data Process with `projects`, `time-tracking` and `settings`; the device runs in Berlin. */
async function start() {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
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
  const saveTimeZone = (name: string) =>
    client.settings.save({ entries: [{ key: TIME_ZONE_SETTING.key, value: name }] });
  /**
   * Writes a column of a stored row as another device or a later version would: no Operation of
   * this version writes such a value.
   */
  async function storeAsElsewhere(
    id: string,
    values: { rounding_rule?: string; time_zone?: string },
  ) {
    await process.database.kysely
      .withTables<{ time_entries: { id: string; rounding_rule: string; time_zone: string } }>()
      .updateTable("time_entries")
      .set(values)
      .where("id", "=", id)
      .execute();
  }
  return { client, saveTimeZone, storeAsElsewhere };
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

const minutes = (count: number) => count * 60;
// The rounding resolution's timer, in UTC: 10:07:30 to 10:29:50, 22:20 measured.
const MEASURED = { startedAt: "2026-11-16T10:07:30.000Z", endedAt: "2026-11-16T10:29:50.000Z" };
const at = (clock: string) => `2026-11-16T${clock}.000Z`;
const UP_15: RoundingRule = { kind: "ordinary", direction: "up", minutes: 15 };

describe("the rounding resolution's table, each rule chosen by hand, from create to the Query", () => {
  test.each<[string, RoundingRule, [string, string], number]>([
    ["exact", { kind: "exact" }, ["10:07:30", "10:29:50"], minutes(22) + 20],
    ["round up to 1 minute", DEFAULT_ROUNDING_RULE, ["10:07:00", "10:30:00"], minutes(23)],
    ["round up to 15 minutes", UP_15, ["10:07:00", "10:37:00"], minutes(30)],
    [
      "round down to 15 minutes",
      { kind: "ordinary", direction: "down", minutes: 15 },
      ["10:07:00", "10:22:00"],
      minutes(15),
    ],
    ["Blocks of 15 minutes", { kind: "block", minutes: 15 }, ["10:00:00", "10:30:00"], minutes(30)],
  ])("%s", async (_name, rule, [from, to], bookedDuration) => {
    const { client } = await start();
    const created = await client.timeTracking.create({ ...MEASURED, ruleByHand: rule });
    const expected = {
      ...MEASURED,
      roundedTime: { start: at(from), end: at(to) },
      bookedDuration,
      roundingRule: rule,
      ruleByHand: rule,
    };
    expect(created).toMatchObject(expected);
    await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject(expected);
    const week = await client.timeTracking.days({
      span: { first: "2026-11-16", last: "2026-11-22" },
    });
    expect(week.days[0]?.entries).toMatchObject([
      { id: created.id, roundedTime: { start: at(from), end: at(to) }, dayShare: bookedDuration },
    ]);
    expect(week.total).toBe(bookedDuration);
  });
});

test("40 seconds rounded down to 15 minutes count 0:00 and are stored without a Rounded Time", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create({
    startedAt: at("10:07:30"),
    endedAt: at("10:08:10"),
    ruleByHand: { kind: "ordinary", direction: "down", minutes: 15 },
  });
  expect(created).toMatchObject({ roundedTime: null, bookedDuration: 0 });
  await expect(client.timeTracking.entry({ id: created.id })).resolves.toMatchObject({
    startedAt: at("10:07:30"),
    endedAt: at("10:08:10"),
    roundedTime: null,
  });
});

test("an edit keeps the entry's own rule without a rule, marks a rule given by hand, and looks it up again on null", async () => {
  const { client } = await start();
  const created = await client.timeTracking.create(MEASURED);
  expect(created).toMatchObject({ roundingRule: DEFAULT_ROUNDING_RULE, ruleByHand: null });
  const { id } = created;

  await expect(client.timeTracking.edit({ id, ruleByHand: UP_15 })).resolves.toMatchObject({
    roundedTime: { start: at("10:07:00"), end: at("10:37:00") },
    bookedDuration: minutes(30),
    roundingRule: UP_15,
    ruleByHand: UP_15,
  });
  // Without a rule the edit keeps the entry's own one, chosen by hand, and its mark.
  await expect(client.timeTracking.edit({ id, note: "Review" })).resolves.toMatchObject({
    bookedDuration: minutes(30),
    roundingRule: UP_15,
    ruleByHand: UP_15,
    note: "Review",
  });
  // "Look up again": the rule that holds, and no mark.
  await expect(client.timeTracking.edit({ id, ruleByHand: null })).resolves.toMatchObject({
    roundedTime: { start: at("10:07:00"), end: at("10:30:00") },
    bookedDuration: minutes(23),
    roundingRule: DEFAULT_ROUNDING_RULE,
    ruleByHand: null,
  });
});

test("an edit of start and end rounds with the entry's own rule", async () => {
  const { client } = await start();
  const { id } = await client.timeTracking.create({ ...MEASURED, ruleByHand: UP_15 });
  await expect(
    client.timeTracking.edit({ id, startedAt: at("11:00:10"), endedAt: at("11:16:00") }),
  ).resolves.toMatchObject({
    startedAt: at("11:00:10"),
    endedAt: at("11:16:00"),
    roundedTime: { start: at("11:00:00"), end: at("11:30:00") },
    bookedDuration: minutes(30),
    roundingRule: UP_15,
    ruleByHand: UP_15,
  });
});

test("an entry whose stored rule this version cannot read is answered with its stored numbers, and an edit is refused at the rule", async () => {
  const { client, storeAsElsewhere } = await start();
  const created = await client.timeTracking.create({ ...MEASURED, ruleByHand: UP_15 });
  const { id } = created;
  // A later version's kind of rule.
  await storeAsElsewhere(id, { rounding_rule: '{"kind":"minimum","minutes":30}' });
  const stored = { ...created, roundingRule: null, ruleByHand: null };

  await expect(client.timeTracking.entry({ id })).resolves.toEqual({ ...stored, project: null });
  for (const edit of [
    { note: "Review" },
    { startedAt: at("11:00:00"), endedAt: at("11:30:00") },
    { ruleByHand: UP_15 },
  ]) {
    await expect(errorOf(client.timeTracking.edit({ id, ...edit }))).resolves.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ path: ["ruleByHand"], params: { reason: ROUNDING_RULE_UNKNOWN } }] },
    });
  }
  // An edit without fields reads; delete and restore change the row only.
  await expect(client.timeTracking.edit({ id })).resolves.toEqual(stored);
  await expect(client.timeTracking.delete({ id })).resolves.toEqual(stored);
  await expect(client.timeTracking.restore({ id })).resolves.toEqual(stored);
  const week = await client.timeTracking.days({
    span: { first: "2026-11-16", last: "2026-11-22" },
  });
  expect(week.total).toBe(minutes(30));
});

test("Block Rounding counts the Blocks in the entry's Time Zone, and in UTC with a mark when this runtime does not know it", async () => {
  const { client, saveTimeZone, storeAsElsewhere } = await start();
  // Kolkata runs on UTC+5:30: 10:07:30 UTC is 15:37:30 there, in the Block 15:00 to 16:00.
  await saveTimeZone("Asia/Kolkata");
  const hour: RoundingRule = { kind: "block", minutes: 60 };
  const created = await client.timeTracking.create({ ...MEASURED, ruleByHand: hour });
  expect(created).toMatchObject({
    roundedTime: { start: at("09:30:00"), end: at("10:30:00") },
    findings: [],
  });

  // A zone another device knows and this runtime does not.
  await storeAsElsewhere(created.id, { time_zone: "Mars/Olympus_Mons" });
  await expect(client.timeTracking.edit({ id: created.id, note: "Review" })).resolves.toMatchObject(
    {
      roundedTime: { start: at("10:00:00"), end: at("11:00:00") },
      bookedDuration: minutes(60),
      findings: [{ reason: TIME_ZONE_UNKNOWN }],
    },
  );
});
