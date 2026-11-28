// The Fixed Answers of `time-tracking` (D255): the Query of a Day Span answers from the stored
// entries for whatever span and filter the View asks, as the Data Process groups them.

import { OLD_SITE, projectReference, WEBSITE } from "@self-engine/projects/testing";
import { resolveTimeZone } from "@self-engine/time";
import { expect, test } from "vite-plus/test";
import {
  runningTimer,
  sampleTimeEntryId,
  sampleTimerId,
  timeEntry,
  timeTrackingAnswers,
  timeTrackingStoryPort,
} from "./index.ts";

const WEEK = { first: "2026-11-16", last: "2026-11-22" };
const NIGHT = timeEntry(1, {
  startedAt: "2026-11-19T21:00:00.000Z",
  endedAt: "2026-11-20T00:30:00.000Z",
  project: projectReference(WEBSITE),
  note: "Release",
});
const MORNING = timeEntry(2, {
  startedAt: "2026-11-20T08:00:00.000Z",
  endedAt: "2026-11-20T08:44:10.000Z",
});

const daysOf = (answer: unknown) =>
  (answer as { days: { day: string; total: number; entries: { id: string }[] }[] }).days;

test("a sample entry carries a numbered id, and its Rounded Time and Booked Duration as the default rule makes them", () => {
  expect(NIGHT).toMatchObject({ id: sampleTimeEntryId(1), bookedDuration: 12_600 });
  // 44:10 measured, rounded up to the minute.
  expect(MORNING).toMatchObject({
    roundedTime: { start: "2026-11-20T08:00:00.000Z", end: "2026-11-20T08:45:00.000Z" },
    bookedDuration: 2700,
    ruleByHand: null,
    projects: [],
  });
  // A rule chosen by hand.
  expect(timeEntry(9, { ...MORNING, rule: { kind: "exact" } })).toMatchObject({
    bookedDuration: 2650,
    ruleByHand: { kind: "exact" },
  });
});

test("the days answer the asked span in the Time Zone: an entry across midnight lies on both days", async () => {
  const access = timeTrackingAnswers({ entries: [MORNING, NIGHT] });
  const answer = await access.call("timeTracking", "days", { span: WEEK });

  const days = daysOf(answer);
  expect(days.map(({ day }) => day)).toEqual([
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
  // Berlin is UTC+1: 22:00 to 01:30, then 09:00 to 09:44:10, which counts 0:45.
  expect(days[3]).toMatchObject({
    total: 7200,
    entries: [{ id: NIGHT.id, dayShare: 7200, crossesMidnight: true }],
  });
  expect(days[4]).toMatchObject({
    total: 5400 + 2700,
    entries: [
      { id: NIGHT.id, dayShare: 5400, crossesMidnight: true },
      { id: MORNING.id, dayShare: 2700, crossesMidnight: false },
    ],
  });
  expect(answer).toMatchObject({
    projects: [
      { project: { id: WEBSITE.id }, total: 12_600 },
      { project: null, total: 2700 },
    ],
    total: 15_300,
  });
});

test("in a zone west of UTC the same entries fall on other days", async () => {
  const access = timeTrackingAnswers({
    entries: [NIGHT],
    timeZone: resolveTimeZone("America/Los_Angeles").timeZone,
  });
  const days = daysOf(await access.call("timeTracking", "days", { span: WEEK }));
  // 13:00 to 16:30 on Thursday in Los Angeles.
  expect(days.map(({ total }) => total)).toEqual([0, 0, 0, 12_600, 0, 0, 0]);
});

test("a filter acts on the entries and the sums, as the Data Process's does", async () => {
  const archived = timeEntry(3, {
    startedAt: "2026-11-17T09:00:00.000Z",
    endedAt: "2026-11-17T10:00:00.000Z",
    project: projectReference(OLD_SITE),
  });
  const access = timeTrackingAnswers({ entries: [MORNING, NIGHT, archived] });
  await expect(
    access.call("timeTracking", "days", { span: WEEK, filter: { kind: "noProject" } }),
  ).resolves.toMatchObject({ projects: [{ project: null, total: 2700 }], total: 2700 });
  await expect(
    access.call("timeTracking", "days", {
      span: WEEK,
      filter: { kind: "project", projectId: OLD_SITE.id },
    }),
  ).resolves.toMatchObject({ total: 3600 });
});

test("a story may fix the answer of the days instead, such as a failed load", async () => {
  const access = timeTrackingAnswers({}, { days: "unexpected" });
  await expect(access.call("timeTracking", "days", { span: WEEK })).rejects.toThrow();
});

test("the story Port changes the stored entries and delivers the Table Change of both tables", async () => {
  const port = timeTrackingStoryPort({ entries: [] });
  const changed: unknown[] = [];
  port.access.onTablesChanged((tables) => changed.push(tables));
  expect(port.access.describeEntry("timeTracking", "days")).toMatchObject({ kind: "query" });

  port.change({ entries: [MORNING] });

  expect(changed).toEqual([["time_entries", "timers"]]);
  const days = daysOf(await port.access.call("timeTracking", "days", { span: WEEK }));
  expect(days[4]?.total).toBe(2700);
});

test("the Query of one entry answers the stored entry of that id, or no entry", async () => {
  const access = timeTrackingAnswers({ entries: [NIGHT] });
  await expect(access.call("timeTracking", "entry", { id: NIGHT.id })).resolves.toEqual(NIGHT);
  await expect(access.call("timeTracking", "entry", { id: MORNING.id })).resolves.toBeNull();
});

test("the story Port records each Operation, and its change follows in the Query of one entry", async () => {
  const port = timeTrackingStoryPort({ entries: [NIGHT] }, {}, (call, of) => {
    if (call.entry === "delete") of.change({ entries: [] });
  });
  await port.access.call("timeTracking", "entry", { id: NIGHT.id });
  await port.access.call("timeTracking", "delete", { id: NIGHT.id });

  expect(port.calls).toEqual([{ entry: "delete", input: { id: NIGHT.id } }]);
  await expect(port.access.call("timeTracking", "entry", { id: NIGHT.id })).resolves.toBeNull();
});

const NINE = runningTimer(1, { startedAt: "2026-11-20T08:00:00.000Z", note: "Mail" });
const TEN = runningTimer(2, {
  startedAt: "2026-11-20T09:00:00.000Z",
  project: projectReference(WEBSITE),
});

test("a sample timer runs from a whole second, with a numbered id and its Project Reference", () => {
  expect(TEN).toMatchObject({
    id: sampleTimerId(2),
    startedAt: "2026-11-20T09:00:00.000Z",
    projectId: WEBSITE.id,
    note: null,
    project: { title: WEBSITE.title },
  });
  expect(NINE).toMatchObject({ projectId: null, project: null, note: "Mail" });
});

test("the running timers answer the stored ones, the most recently started first, and none by default", async () => {
  await expect(
    timeTrackingAnswers().call("timeTracking", "runningTimers", undefined),
  ).resolves.toEqual([]);
  const access = timeTrackingAnswers({ timers: [NINE, TEN] });
  await expect(access.call("timeTracking", "runningTimers", undefined)).resolves.toEqual([
    TEN,
    NINE,
  ]);
});

test("every timer Operation succeeds with a sample answer", async () => {
  const access = timeTrackingAnswers();
  const id = sampleTimerId(1);
  await expect(access.call("timeTracking", "startTimer", {})).resolves.toMatchObject({
    timer: { startedAt: expect.any(String) },
    others: [],
  });
  await expect(access.call("timeTracking", "stopTimer", { id })).resolves.toMatchObject({
    kind: "saved",
  });
  await expect(access.call("timeTracking", "undoStopTimer", { id })).resolves.toMatchObject({
    kind: "restored",
    others: [],
  });
  await expect(access.call("timeTracking", "undoDiscardTimer", { id })).resolves.toMatchObject({
    kind: "restored",
  });
  // A Fixed Answer is fixed: the sample timer, whichever id was asked.
  const sample = { id: sampleTimerId(100), startedAt: "2026-11-16T08:00:00.000Z" };
  await expect(access.call("timeTracking", "discardTimer", { id })).resolves.toMatchObject(sample);
  await expect(access.call("timeTracking", "editTimer", { id })).resolves.toMatchObject(sample);
});

test("a story's Port changes the running timers, with the Table Change of both tables", async () => {
  const port = timeTrackingStoryPort({ timers: [TEN] });
  const changed: unknown[] = [];
  port.access.onTablesChanged((tables) => changed.push(tables));
  await expect(port.access.call("timeTracking", "runningTimers", undefined)).resolves.toEqual([
    TEN,
  ]);
  port.change({ timers: [] });
  await expect(port.access.call("timeTracking", "runningTimers", undefined)).resolves.toEqual([]);
  expect(changed).toEqual([["time_entries", "timers"]]);
});
