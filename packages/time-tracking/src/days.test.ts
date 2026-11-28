// The Query of a Day Span through the Port of the test Data Process, as the week View calls it:
// the page names the span, the Data Process reads the Time Zone and answers with the entries of
// each day, their Day Shares and the sums. 16 November 2026 is a Monday.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import type { ProjectId } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone } from "@self-engine/time";
import { SETTINGS_TABLE } from "@self-engine/storage";
import { TIME_ZONE_SETTING, WEEK_START_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, test } from "vite-plus/test";
import type { DaysInput } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";
import { asWorkEntry } from "./testing/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

type TimeTrackingClient = ContractRouterClient<
  ProtocolContract & {
    projects: typeof projects.contract;
    timeTracking: typeof timeTracking.contract;
    settings: typeof settings.contract;
  }
>;

/** Starts the test Data Process with `projects`, `time-tracking` and `settings`; the device runs in Berlin. */
async function startTimeTracking() {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
  });
  started.push(process);
  const client: TimeTrackingClient = createORPCClient(new RPCLink({ port: process.openPort() }));
  /** Saves the Time Zone as the settings area does. */
  const saveTimeZone = (name: string) =>
    client.settings.save({ entries: [{ key: TIME_ZONE_SETTING.key, value: name }] });
  return { process, client, saveTimeZone };
}

/** The error a call answers with, or `undefined` when it answers. */
async function errorOf(call: Promise<unknown>) {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  return error as { code: string; data?: { issues?: unknown[]; reasons?: unknown[] } } | undefined;
}

/** An entry as a list answers it: without its rule, its findings and its breaks. */
const listed = (created: Awaited<ReturnType<TimeTrackingClient["timeTracking"]["create"]>>) => {
  const {
    roundingRule: _rule,
    ruleByHand: _byHand,
    findings: _findings,
    breaks: _breaks,
    ...entry
  } = asWorkEntry(created);
  return entry;
};
const hours = (count: number) => count * 3600;
const LAST_WEEK = { first: "2026-11-09", last: "2026-11-15" };
const THIS_WEEK = { first: "2026-11-16", last: "2026-11-22" };

/** Each day of an answer as its day, its sum and the Day Share of each entry, by note. */
async function daysOf(client: TimeTrackingClient, input: DaysInput) {
  const answer = await client.timeTracking.days(input);
  return answer.days.map((day) => ({
    day: day.day,
    total: day.total,
    entries: day.entries.map((entry) => [entry.note, entry.dayShare, entry.crossesMidnight]),
  }));
}

const create = (
  client: TimeTrackingClient,
  startedAt: string,
  endedAt: string,
  { note, projectId }: { note?: string; projectId?: ProjectId } = {},
) =>
  client.timeTracking.create({
    startedAt,
    endedAt,
    ...(note === undefined ? {} : { note }),
    // One project, as the Edit Drawer sends it.
    ...(projectId === undefined ? {} : { projects: [{ projectId }] }),
  });

test("an entry from Sunday 22:00 to Monday 02:00 appears on both days with 2:00, marked, and each week counts 2:00", async () => {
  const { client } = await startTimeTracking();
  // Berlin: 21:00 UTC is 22:00.
  const night = await create(client, "2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z", {
    note: "Night",
  });

  const both = await client.timeTracking.days({
    span: { first: "2026-11-15", last: "2026-11-16" },
  });
  expect(both.days).toEqual([
    {
      day: "2026-11-15",
      total: hours(2),
      entries: [
        {
          ...listed(night),
          dayShare: hours(2),
          crossesMidnight: true,
          overlaps: false,
        },
      ],
    },
    {
      day: "2026-11-16",
      total: hours(2),
      entries: [
        {
          ...listed(night),
          dayShare: hours(2),
          crossesMidnight: true,
          overlaps: false,
        },
      ],
    },
  ]);
  expect(both.total).toBe(hours(4));

  const last = await client.timeTracking.days({ span: LAST_WEEK });
  const next = await client.timeTracking.days({ span: THIS_WEEK });
  expect([last.total, next.total]).toEqual([hours(2), hours(2)]);
  expect(last.days.at(-1)?.entries).toMatchObject([{ id: night.id, crossesMidnight: true }]);
  expect(next.days[0]?.entries).toMatchObject([{ id: night.id, crossesMidnight: true }]);
  expect(last.projects).toEqual([{ project: null, total: hours(2) }]);
  expect(next.projects).toEqual([{ project: null, total: hours(2) }]);
});

test("every day of the span is listed in order, an empty one with a sum of zero, each with its entries sorted by start", async () => {
  const { client } = await startTimeTracking();
  await create(client, "2026-11-17T13:00:00.000Z", "2026-11-17T14:00:00.000Z", { note: "Late" });
  await create(client, "2026-11-17T08:00:00.000Z", "2026-11-17T09:30:00.000Z", { note: "Early" });

  await expect(daysOf(client, { span: THIS_WEEK })).resolves.toEqual([
    { day: "2026-11-16", total: 0, entries: [] },
    {
      day: "2026-11-17",
      total: hours(2.5),
      entries: [
        ["Early", hours(1.5), false],
        ["Late", hours(1), false],
      ],
    },
    { day: "2026-11-18", total: 0, entries: [] },
    { day: "2026-11-19", total: 0, entries: [] },
    { day: "2026-11-20", total: 0, entries: [] },
    { day: "2026-11-21", total: 0, entries: [] },
    { day: "2026-11-22", total: 0, entries: [] },
  ]);
});

test("an empty span answers its days with zero and no project line", async () => {
  const { client } = await startTimeTracking();
  const answer = await client.timeTracking.days({ span: THIS_WEEK });
  expect(answer.days).toHaveLength(7);
  expect(answer.projects).toEqual([]);
  expect(answer.total).toBe(0);
});

test("an entry over three days counts a share on each, and a span counts only the parts inside it", async () => {
  const { client } = await startTimeTracking();
  // Monday 20:00 to Wednesday 04:00 in Berlin.
  const long = await create(client, "2026-11-16T19:00:00.000Z", "2026-11-18T03:00:00.000Z", {
    note: "Long",
  });

  const week = await daysOf(client, { span: THIS_WEEK });
  expect(week.slice(0, 3)).toEqual([
    { day: "2026-11-16", total: hours(4), entries: [["Long", hours(4), true]] },
    { day: "2026-11-17", total: hours(24), entries: [["Long", hours(24), true]] },
    { day: "2026-11-18", total: hours(4), entries: [["Long", hours(4), true]] },
  ]);
  const shares = week.flatMap((day) => day.entries.map((entry) => entry[1]));
  expect(shares.reduce<number>((sum, share) => sum + Number(share), 0)).toBe(long.bookedDuration);

  // A span inside the entry: the entry begins before it and ends after it.
  const tuesday = await client.timeTracking.days({
    span: { first: "2026-11-17", last: "2026-11-17" },
  });
  expect(tuesday.total).toBe(hours(24));
  expect(tuesday.days[0]?.entries).toMatchObject([{ id: long.id, crossesMidnight: true }]);
});

test("a night of a clock change in Berlin counts the time that passed, and a 25-hour day its whole length", async () => {
  const { client } = await startTimeTracking();
  // Saturday 22:00 to Sunday 06:00 on the wall clock, the night the clocks go forward: 7 hours.
  const forward = await create(client, "2026-03-28T21:00:00.000Z", "2026-03-29T04:00:00.000Z", {
    note: "Forward",
  });
  // The whole Sunday the clocks go back, midnight to midnight: 25 hours.
  const back = await create(client, "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z", {
    note: "Back",
  });
  expect([forward.bookedDuration, back.bookedDuration]).toEqual([hours(7), hours(25)]);

  await expect(
    daysOf(client, { span: { first: "2026-03-28", last: "2026-03-29" } }),
  ).resolves.toEqual([
    { day: "2026-03-28", total: hours(2), entries: [["Forward", hours(2), true]] },
    { day: "2026-03-29", total: hours(5), entries: [["Forward", hours(5), true]] },
  ]);
  await expect(
    daysOf(client, { span: { first: "2026-10-24", last: "2026-10-26" } }),
  ).resolves.toEqual([
    { day: "2026-10-24", total: 0, entries: [] },
    { day: "2026-10-25", total: hours(25), entries: [["Back", hours(25), false]] },
    { day: "2026-10-26", total: 0, entries: [] },
  ]);
});

test("the days follow the Time Zone of the Setting: east and west of UTC the same entries fall on other days", async () => {
  const { client, saveTimeZone } = await startTimeTracking();
  // 22:00 UTC on Sunday 15 November to 00:00 UTC on Monday.
  await create(client, "2026-11-15T22:00:00.000Z", "2026-11-16T00:00:00.000Z", { note: "Evening" });
  const span = { first: "2026-11-15", last: "2026-11-16" };

  // Berlin: Sunday 23:00 to Monday 01:00, one hour on each day.
  await expect(daysOf(client, { span })).resolves.toEqual([
    { day: "2026-11-15", total: hours(1), entries: [["Evening", hours(1), true]] },
    { day: "2026-11-16", total: hours(1), entries: [["Evening", hours(1), true]] },
  ]);
  // Tokyo: Monday 07:00 to 09:00.
  await saveTimeZone("Asia/Tokyo");
  await expect(daysOf(client, { span })).resolves.toEqual([
    { day: "2026-11-15", total: 0, entries: [] },
    { day: "2026-11-16", total: hours(2), entries: [["Evening", hours(2), false]] },
  ]);
  // New York: Sunday 17:00 to 19:00.
  await saveTimeZone("America/New_York");
  await expect(daysOf(client, { span })).resolves.toEqual([
    { day: "2026-11-15", total: hours(2), entries: [["Evening", hours(2), false]] },
    { day: "2026-11-16", total: 0, entries: [] },
  ]);
});

test("the Query names the Settings table among its reads, so a change of the Time Zone reloads it", async () => {
  const { client, saveTimeZone } = await startTimeTracking();
  const events = await client.tablesChanged();
  const opened = await events.next();
  expect(opened.value).toMatchObject({ kind: "opened" });
  const reads = (opened.value as { queries: { timeTracking: { days: string[] } } }).queries
    .timeTracking.days;
  expect([...reads].sort()).toEqual(
    [SETTINGS_TABLE, "project_shares", "projects", "time_entries"].sort(),
  );

  await saveTimeZone("America/New_York");

  const changed = await events.next();
  expect(changed.value).toMatchObject({ kind: "changed" });
  expect((changed.value as { tables: string[] }).tables).toContain(SETTINGS_TABLE);
  await events.return();
});

test("the sums per day, per project and in total match the entries; no project has its own line, last", async () => {
  const { client } = await startTimeTracking();
  const website = await client.projects.create({ title: "Website", icon: "house", color: "teal" });
  const shop = await client.projects.create({ title: "Shop" });
  await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T09:00:00.000Z", {
    projectId: website.id,
  });
  await create(client, "2026-11-17T08:00:00.000Z", "2026-11-17T10:00:00.000Z", {
    projectId: website.id,
  });
  await create(client, "2026-11-17T10:00:00.000Z", "2026-11-17T14:00:00.000Z", {
    projectId: shop.id,
  });
  await create(client, "2026-11-18T08:00:00.000Z", "2026-11-18T08:30:00.000Z");
  // Outside the span: counts nowhere.
  await create(client, "2026-11-23T08:00:00.000Z", "2026-11-23T09:00:00.000Z", {
    projectId: website.id,
  });

  const answer = await client.timeTracking.days({ span: THIS_WEEK });

  expect(answer.days.slice(0, 3).map((day) => day.total)).toEqual([hours(1), hours(6), hours(0.5)]);
  expect(answer.projects).toEqual([
    {
      project: {
        id: shop.id,
        title: "Shop",
        icon: null,
        color: null,
        archivedAt: null,
        deletedAt: null,
      },
      total: hours(4),
    },
    {
      project: {
        id: website.id,
        title: "Website",
        icon: "house",
        color: "teal",
        archivedAt: null,
        deletedAt: null,
      },
      total: hours(3),
    },
    { project: null, total: hours(0.5) },
  ]);
  expect(answer.total).toBe(hours(7.5));
  expect(
    answer.days[1]?.entries.map((entry) => asWorkEntry(entry).projects[0]?.project.title ?? null),
  ).toEqual(["Website", "Shop"]);
});

test("intersecting entries are both marked and count in full in the day and week", async () => {
  const { client } = await startTimeTracking();
  const first = await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T10:00:00.000Z");
  const second = await create(client, "2026-11-16T09:00:00.000Z", "2026-11-16T12:00:00.000Z");

  const answer = await client.timeTracking.days({ span: THIS_WEEK });

  expect(answer.days[0]).toMatchObject({
    entries: [
      { id: first.id, overlaps: true, dayShare: hours(2) },
      { id: second.id, overlaps: true, dayShare: hours(3) },
    ],
    total: hours(5),
  });
  expect(answer.total).toBe(hours(5));
  expect(answer.projects).toEqual([{ project: null, total: hours(5) }]);
});

test("among three entries, only the two that intersect are marked", async () => {
  const { client } = await startTimeTracking();
  const first = await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T10:00:00.000Z");
  const second = await create(client, "2026-11-16T09:00:00.000Z", "2026-11-16T11:00:00.000Z");
  const third = await create(client, "2026-11-16T11:00:00.000Z", "2026-11-16T12:00:00.000Z");

  const answer = await client.timeTracking.days({ span: THIS_WEEK });

  expect(answer.days[0]?.entries).toMatchObject([
    { id: first.id, overlaps: true },
    { id: second.id, overlaps: true },
    { id: third.id, overlaps: false },
  ]);
});

test("an entry across midnight is marked only in spans its overlapping entry also touches", async () => {
  const { client } = await startTimeTracking();
  const night = await create(client, "2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z");
  // Ends more than an hour, the reach of any rule, before midnight in Berlin, where the next week
  // starts: the read of the next week does not see it.
  const evening = await create(client, "2026-11-15T21:00:00.000Z", "2026-11-15T21:30:00.000Z");

  const lastWeek = await client.timeTracking.days({ span: LAST_WEEK });
  expect(lastWeek.days.at(-1)?.entries).toMatchObject([
    { id: night.id, overlaps: true },
    { id: evening.id, overlaps: true },
  ]);
  const thisWeek = await client.timeTracking.days({ span: THIS_WEEK });
  expect(thisWeek.days[0]?.entries).toMatchObject([{ id: night.id, overlaps: false }]);
});

test("a project entry keeps its overlap mark when a filter hides the other project", async () => {
  const { client } = await startTimeTracking();
  const website = await client.projects.create({ title: "Website" });
  const shop = await client.projects.create({ title: "Shop" });
  const visible = await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T10:00:00.000Z", {
    projectId: website.id,
  });
  await create(client, "2026-11-16T09:00:00.000Z", "2026-11-16T12:00:00.000Z", {
    projectId: shop.id,
  });

  const answer = await client.timeTracking.days({
    span: THIS_WEEK,
    filter: { kind: "project", projectId: website.id },
  });

  expect(answer.days[0]).toMatchObject({
    entries: [{ id: visible.id, overlaps: true }],
    total: hours(2),
  });
  expect(answer.total).toBe(hours(2));
});

test("two projects with the same title stay two lines", async () => {
  const { client } = await startTimeTracking();
  const first = await client.projects.create({ title: "Same" });
  const second = await client.projects.create({ title: "Same" });
  await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T10:00:00.000Z", {
    projectId: first.id,
  });
  await create(client, "2026-11-16T10:00:00.000Z", "2026-11-16T11:00:00.000Z", {
    projectId: second.id,
  });

  const { days, projects } = await client.timeTracking.days({ span: THIS_WEEK });

  expect(days[0]?.entries).toMatchObject([{ overlaps: false }, { overlaps: false }]);
  expect(projects.map((line) => [line.project?.id, line.project?.title, line.total])).toEqual([
    [first.id, "Same", hours(2)],
    [second.id, "Same", hours(1)],
  ]);
});

test("a filter by project or by no project acts on the entries and on every sum", async () => {
  const { client } = await startTimeTracking();
  const website = await client.projects.create({ title: "Website" });
  const shop = await client.projects.create({ title: "Shop" });
  await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T09:00:00.000Z", {
    projectId: website.id,
    note: "Website",
  });
  await create(client, "2026-11-16T09:00:00.000Z", "2026-11-16T11:00:00.000Z", {
    projectId: shop.id,
    note: "Shop",
  });
  await create(client, "2026-11-16T11:00:00.000Z", "2026-11-16T14:00:00.000Z", { note: "None" });

  const all = await client.timeTracking.days({ span: THIS_WEEK });
  expect(all.total).toBe(hours(6));

  const byProject = await client.timeTracking.days({
    span: THIS_WEEK,
    filter: { kind: "project", projectId: website.id },
  });
  expect(byProject.days[0]?.entries.map((entry) => entry.note)).toEqual(["Website"]);
  expect(byProject.days[0]?.total).toBe(hours(1));
  expect(byProject.projects).toEqual([
    { project: expect.objectContaining({ id: website.id }), total: hours(1) },
  ]);
  expect(byProject.total).toBe(hours(1));

  const withoutProject = await client.timeTracking.days({
    span: THIS_WEEK,
    filter: { kind: "noProject" },
  });
  expect(withoutProject.days[0]?.entries.map((entry) => entry.note)).toEqual(["None"]);
  expect(withoutProject.days[0]?.total).toBe(hours(3));
  expect(withoutProject.projects).toEqual([{ project: null, total: hours(3) }]);
  expect(withoutProject.total).toBe(hours(3));
});

test("a deleted entry appears nowhere, and an entry of an archived project keeps its archive mark", async () => {
  const { client } = await startTimeTracking();
  const archived = await client.projects.create({ title: "Old" });
  const kept = await create(client, "2026-11-16T08:00:00.000Z", "2026-11-16T09:00:00.000Z", {
    projectId: archived.id,
  });
  await client.projects.archive({ id: archived.id });
  const gone = await create(client, "2026-11-16T09:00:00.000Z", "2026-11-16T10:00:00.000Z");
  await client.timeTracking.delete({ id: gone.id });

  const answer = await client.timeTracking.days({ span: THIS_WEEK });

  expect(answer.days[0]?.entries).toMatchObject([
    {
      id: kept.id,
      projects: [{ project: { id: archived.id, archivedAt: expect.any(String) } }],
    },
  ]);
  expect(answer.projects).toMatchObject([
    { project: { id: archived.id, archivedAt: expect.any(String) }, total: hours(1) },
  ]);
  expect(answer.total).toBe(hours(1));

  // Restored, it counts again.
  await client.timeTracking.restore({ id: gone.id });
  await expect(client.timeTracking.days({ span: THIS_WEEK })).resolves.toMatchObject({
    total: hours(2),
  });
});

test("the Query takes any span up to 42 days and refuses a longer one, or one that ends before it starts, as an input error", async () => {
  const { client } = await startTimeTracking();
  await expect(
    client.timeTracking.days({ span: { first: "2026-11-16", last: "2026-11-16" } }),
  ).resolves.toMatchObject({ days: [{ day: "2026-11-16" }] });
  const sixWeeks = await client.timeTracking.days({
    span: { first: "2026-11-16", last: "2026-12-27" },
  });
  expect(sixWeeks.days).toHaveLength(42);

  const tooLong = await errorOf(
    client.timeTracking.days({ span: { first: "2026-11-16", last: "2026-12-28" } }),
  );
  expect(tooLong?.code).toBe("BAD_REQUEST");
  expect(tooLong?.data?.issues).toEqual([
    expect.objectContaining({ path: ["span", "last"], params: { reason: "span_too_long" } }),
  ]);
  const backwards = await errorOf(
    client.timeTracking.days({ span: { first: "2026-11-16", last: "2026-11-15" } }),
  );
  expect(backwards?.code).toBe("BAD_REQUEST");
  await expect(client.health()).resolves.toMatchObject({ state: "ready" });
});

test("the week start never changes the answer: the span the page names decides the days", async () => {
  const { client } = await startTimeTracking();
  await create(client, "2026-11-15T21:00:00.000Z", "2026-11-16T01:00:00.000Z");
  const before = await client.timeTracking.days({ span: THIS_WEEK });

  await client.settings.save({ entries: [{ key: WEEK_START_SETTING.key, value: "sunday" }] });

  await expect(client.timeTracking.days({ span: THIS_WEEK })).resolves.toEqual(before);
});

test("an entry stands where its Rounded Time lies: one measured before midnight that counts past it appears on the next day too", async () => {
  const { client } = await startTimeTracking();
  // Sunday 23:50 to 23:58 in Berlin, rounded up to 15 minutes: 23:50 to 00:05.
  const late = await client.timeTracking.create({
    startedAt: "2026-11-15T22:50:00.000Z",
    endedAt: "2026-11-15T22:58:00.000Z",
    ruleByHand: { kind: "ordinary", direction: "up", minutes: 15 },
    note: "Late",
  });

  const next = await client.timeTracking.days({ span: THIS_WEEK });
  expect(next.days[0]?.entries).toMatchObject([
    { id: late.id, dayShare: 5 * 60, crossesMidnight: true },
  ]);
  expect(next.total).toBe(5 * 60);
  const last = await client.timeTracking.days({ span: LAST_WEEK });
  expect(last.days.at(-1)?.entries).toMatchObject([{ id: late.id, dayShare: 10 * 60 }]);
});

test("an entry without a Rounded Time stands on the day of its measured start with 0:00 and overlaps nothing", async () => {
  const { client } = await startTimeTracking();
  const work = await create(client, "2026-11-17T09:00:00.000Z", "2026-11-17T10:00:00.000Z");
  // 40 seconds inside it, rounded down to 15 minutes: nothing counts.
  const nothing = await client.timeTracking.create({
    startedAt: "2026-11-17T09:10:00.000Z",
    endedAt: "2026-11-17T09:10:40.000Z",
    ruleByHand: { kind: "ordinary", direction: "down", minutes: 15 },
  });

  const answer = await client.timeTracking.days({ span: THIS_WEEK });
  expect(answer.days[1]).toMatchObject({
    total: hours(1),
    entries: [
      { id: work.id, overlaps: false, dayShare: hours(1) },
      { id: nothing.id, roundedTime: null, overlaps: false, dayShare: 0 },
    ],
  });
});

test("overlaps are judged on the Rounded Times, and touching ones do not overlap", async () => {
  const { client } = await startTimeTracking();
  const down = { kind: "ordinary", direction: "down", minutes: 15 } as const;
  // Measured, the two overlap by 20 seconds; rounded, 10:00 to 10:30 and 10:30 to 10:45 touch.
  const first = await client.timeTracking.create({
    startedAt: "2026-11-16T09:00:00.000Z",
    endedAt: "2026-11-16T09:30:30.000Z",
    ruleByHand: down,
  });
  const second = await client.timeTracking.create({
    startedAt: "2026-11-16T09:30:10.000Z",
    endedAt: "2026-11-16T09:45:20.000Z",
    ruleByHand: down,
  });
  // Under the default rule a switch at 10:05:30 counts the minute twice: 10:00 to 10:06 and 10:05
  // to 10:10 overlap, though their measured times only touch.
  const third = await create(client, "2026-11-16T10:00:00.000Z", "2026-11-16T10:05:30.000Z");
  const fourth = await create(client, "2026-11-16T10:05:30.000Z", "2026-11-16T10:10:00.000Z");

  const answer = await client.timeTracking.days({ span: THIS_WEEK });
  expect(answer.days[0]?.entries).toMatchObject([
    { id: first.id, overlaps: false },
    { id: second.id, overlaps: false },
    { id: third.id, overlaps: true },
    { id: fourth.id, overlaps: true },
  ]);
});
