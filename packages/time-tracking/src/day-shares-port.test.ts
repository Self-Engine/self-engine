// The Day Shares of an entry across midnight through the Query of a Day Span, as the week View
// calls it (ADR 0044, D343): each day gets the part of the Rounded Time on it without the Rest
// Breaks on it, and each Project Share is divided over the days the same way. 16 November 2026 is
// a Monday; the device and the Setting run in Berlin, 21:00 UTC is 22:00 there.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { createTestSources } from "@self-engine/db/testing";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, test } from "vite-plus/test";
import type { DaysAnswer } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";
import { asWorkEntry } from "./testing/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

/** The test Data Process with `projects`, `time-tracking` and `settings`, the device in Berlin. */
async function start() {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    sources: createTestSources("2026-11-28T12:00:00.000Z"),
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
  return { client, saveTimeZone };
}

const minutes = (count: number) => count * 60;
const MONDAY_AND_TUESDAY = { first: "2026-11-16", last: "2026-11-17" };

/** Each day as its total and the Day Share of each entry on it. */
const dayTotals = (answer: DaysAnswer) =>
  answer.days.map(({ day, total, entries }) => ({
    day,
    total,
    shares: entries.map(({ dayShare }) => dayShare),
  }));

/** The sums per project as title and total; "no project" as `null`. */
const projectTotals = (answer: DaysAnswer) =>
  answer.projects.map(({ project, total }) => [project?.title ?? null, total]);

test("the stretches resolution's example: 22:00 – 02:00 with a Rest Break of 23:30 – 00:30 counts 1:30 on each day", async () => {
  const { client } = await start();
  const entry = await client.timeTracking.create({
    startedAt: "2026-11-16T21:00:00.000Z",
    endedAt: "2026-11-17T01:00:00.000Z",
    breaks: [
      {
        timeKind: "rest_break",
        startedAt: "2026-11-16T22:30:00.000Z",
        endedAt: "2026-11-16T23:30:00.000Z",
        changedByLimit: false,
      },
    ],
  });
  expect(entry.bookedDuration).toBe(minutes(180));

  const answer = await client.timeTracking.days({ span: MONDAY_AND_TUESDAY });
  expect(dayTotals(answer)).toEqual([
    { day: "2026-11-16", total: minutes(90), shares: [minutes(90)] },
    { day: "2026-11-17", total: minutes(90), shares: [minutes(90)] },
  ]);
  expect(answer.total).toBe(minutes(180));
  expect(projectTotals(answer)).toEqual([[null, minutes(180)]]);
});

test("each Project Share is divided over the days, and a filter by project counts that project's part of each day", async () => {
  const { client } = await start();
  const website = (await client.projects.create({ title: "Website" })).id;
  const garden = (await client.projects.create({ title: "Garden" })).id;
  // 22:00 – 02:00 with the Rest Break, for Website and Garden at 2 : 1: Website 2:00, Garden 1:00.
  const entry = await client.timeTracking.create({
    startedAt: "2026-11-16T21:00:00.000Z",
    endedAt: "2026-11-17T01:00:00.000Z",
    breaks: [
      {
        timeKind: "rest_break",
        startedAt: "2026-11-16T22:30:00.000Z",
        endedAt: "2026-11-16T23:30:00.000Z",
        changedByLimit: false,
      },
    ],
    projects: [
      { projectId: website, weight: 2 },
      { projectId: garden, weight: 1 },
    ],
  });
  expect(asWorkEntry(entry).projects.map(({ projectShare }) => projectShare)).toEqual([
    minutes(120),
    minutes(60),
  ]);

  const all = await client.timeTracking.days({ span: MONDAY_AND_TUESDAY });
  expect(projectTotals(all)).toEqual([
    ["Website", minutes(120)],
    ["Garden", minutes(60)],
  ]);
  const monday = await client.timeTracking.days({
    span: { first: "2026-11-16", last: "2026-11-16" },
  });
  expect(projectTotals(monday)).toEqual([
    ["Website", minutes(60)],
    ["Garden", minutes(30)],
  ]);

  const onlyGarden = await client.timeTracking.days({
    span: MONDAY_AND_TUESDAY,
    filter: { kind: "project", projectId: garden },
  });
  // The totals count Garden's part; each entry's Day Share stays the whole entry's.
  expect(dayTotals(onlyGarden)).toEqual([
    { day: "2026-11-16", total: minutes(30), shares: [minutes(90)] },
    { day: "2026-11-17", total: minutes(30), shares: [minutes(90)] },
  ]);
  expect(projectTotals(onlyGarden)).toEqual([["Garden", minutes(60)]]);
});

test("a span counts only the part of an entry inside it, so two weeks add up to the entry", async () => {
  const { client } = await start();
  // Sunday 22:00 – Monday 02:00 with a Rest Break of Monday 00:30 – 01:00: 3:30 counts.
  await client.timeTracking.create({
    startedAt: "2026-11-15T21:00:00.000Z",
    endedAt: "2026-11-16T01:00:00.000Z",
    breaks: [
      {
        timeKind: "rest_break",
        startedAt: "2026-11-15T23:30:00.000Z",
        endedAt: "2026-11-16T00:00:00.000Z",
        changedByLimit: false,
      },
    ],
  });
  const last = await client.timeTracking.days({
    span: { first: "2026-11-09", last: "2026-11-15" },
  });
  const next = await client.timeTracking.days({
    span: { first: "2026-11-16", last: "2026-11-22" },
  });
  expect([last.total, next.total]).toEqual([minutes(120), minutes(90)]);
  expect(projectTotals(last)).toEqual([[null, minutes(120)]]);
  expect(projectTotals(next)).toEqual([[null, minutes(90)]]);
});

test("a Short Break entry across midnight counts on both days", async () => {
  const { client } = await start();
  // 23:50 – 00:10.
  await client.timeTracking.create({
    timeKind: "short_break",
    startedAt: "2026-11-16T22:50:00.000Z",
    endedAt: "2026-11-16T23:10:00.000Z",
  });
  const answer = await client.timeTracking.days({ span: MONDAY_AND_TUESDAY });
  expect(dayTotals(answer)).toEqual([
    { day: "2026-11-16", total: minutes(10), shares: [minutes(10)] },
    { day: "2026-11-17", total: minutes(10), shares: [minutes(10)] },
  ]);
  expect(projectTotals(answer)).toEqual([[null, minutes(20)]]);
});

test("the days follow the Time Zone of the call, also one whose offset is no whole hour", async () => {
  const { client, saveTimeZone } = await start();
  // Made in Berlin, 18:00 – 21:00 there with a Rest Break of 19:00 – 19:45: one day, 2:15.
  await client.timeTracking.create({
    startedAt: "2026-11-16T17:00:00.000Z",
    endedAt: "2026-11-16T20:00:00.000Z",
    breaks: [
      {
        timeKind: "rest_break",
        startedAt: "2026-11-16T18:00:00.000Z",
        endedAt: "2026-11-16T18:45:00.000Z",
        changedByLimit: false,
      },
    ],
  });
  const berlin = await client.timeTracking.days({ span: MONDAY_AND_TUESDAY });
  expect(dayTotals(berlin)).toEqual([
    { day: "2026-11-16", total: minutes(135), shares: [minutes(135)] },
    { day: "2026-11-17", total: 0, shares: [] },
  ]);
  // Kathmandu is 5:45 ahead of UTC: 22:45 – 01:45 with the Rest Break of 23:45 – 00:30. Before
  // midnight 1:15 less 0:15 of the break, after it 1:45 less 0:30.
  await saveTimeZone("Asia/Kathmandu");
  const kathmandu = await client.timeTracking.days({ span: MONDAY_AND_TUESDAY });
  expect(dayTotals(kathmandu)).toEqual([
    { day: "2026-11-16", total: minutes(60), shares: [minutes(60)] },
    { day: "2026-11-17", total: minutes(75), shares: [minutes(75)] },
  ]);
});
