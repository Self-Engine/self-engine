// The Fixed Answers of `time-tracking` (D255): the Query of a Day Span answers from the stored
// entries for whatever span and filter the View asks, as the Data Process groups them.

import { OLD_SITE, projectReference, WEBSITE } from "@self-engine/projects/testing";
import { resolveTimeZone } from "@self-engine/time";
import { expect, test } from "vite-plus/test";
import {
  sampleTimeEntryId,
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

test("a sample entry carries its Booked Duration, end minus start, and a numbered id", () => {
  expect(NIGHT).toMatchObject({ id: sampleTimeEntryId(1), durationSeconds: 12_600 });
  expect(MORNING.project).toBeNull();
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
  // Berlin is UTC+1: 22:00 to 01:30, then 09:00 to 09:44:10.
  expect(days[3]).toMatchObject({
    total: 7200,
    entries: [{ id: NIGHT.id, dayShare: 7200, crossesMidnight: true }],
  });
  expect(days[4]).toMatchObject({
    total: 5400 + 2650,
    entries: [
      { id: NIGHT.id, dayShare: 5400, crossesMidnight: true },
      { id: MORNING.id, dayShare: 2650, crossesMidnight: false },
    ],
  });
  expect(answer).toMatchObject({
    projects: [
      { project: { id: WEBSITE.id }, total: 12_600 },
      { project: null, total: 2650 },
    ],
    total: 15_250,
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
  ).resolves.toMatchObject({ projects: [{ project: null, total: 2650 }], total: 2650 });
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

test("the story Port changes the stored entries and delivers the Table Change of time_entries", async () => {
  const port = timeTrackingStoryPort({ entries: [] });
  const changed: unknown[] = [];
  port.access.onTablesChanged((tables) => changed.push(tables));
  expect(port.access.describeEntry("timeTracking", "days")).toMatchObject({ kind: "query" });

  port.change({ entries: [MORNING] });

  expect(changed).toEqual([["time_entries"]]);
  const days = daysOf(await port.access.call("timeTracking", "days", { span: WEEK }));
  expect(days[4]?.total).toBe(2650);
});
