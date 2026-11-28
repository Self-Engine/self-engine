// @vitest-environment happy-dom
// End to end without the app (#33): the module's Query hook over the real client, building block
// and test Data Process with `projects` and `time-tracking` mounted. The week follows each write
// through the Table Change of its commit alone. No fake answers: each step waits for the render
// it expects.

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { type DataAccess, DataProvider, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { calendarDaySchema, resolveTimeZone, weekOf } from "@self-engine/time";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { timeTracking } from "./data/index.ts";
import { asWorkEntry } from "./testing/index.ts";
import { useSpanDays } from "./port.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// The hook renders outside `act`: answers arrive over a real port, at no moment a test can name.
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

function untilReady(connection: DataConnection): Promise<void> {
  return new Promise((resolve) => {
    if (connection.getState().status === "ready") return resolve();
    const unsubscribe = connection.subscribe(() => {
      if (connection.getState().status !== "ready") return;
      unsubscribe();
      resolve();
    });
  });
}

/** The week of Monday 16 November 2026, as the View asks for it with Monday as the first day. */
const WEEK = weekOf(calendarDaySchema.parse("2026-11-18"), "monday");

type Days = ReturnType<typeof useSpanDays>;

/** Draws the week after `setup`, whose writes the first answer already holds. */
async function renderWeek(
  setup: (
    call: (module: string, entry: string, input: unknown) => Promise<unknown>,
  ) => Promise<void>,
) {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking },
    deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
  });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);
  const access = portAccessOf(connection);
  const data: DataAccess = { access, notify: () => {}, notifyRefused: () => {} };
  const call = (module: string, entry: string, input: unknown) => access.call(module, entry, input);
  await setup(call);

  let days: Days | undefined;
  const waiting = new Set<() => void>();
  function Reader(): ReactNode {
    days = useSpanDays(WEEK);
    for (const check of waiting) check();
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  cleanups.push(() => container.remove());
  const root = createRoot(container);
  cleanups.push(() => root.unmount());
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  root.render(
    createElement(I18nProvider, {
      i18n,
      children: createElement(DataProvider, data, createElement(Reader)),
    }),
  );
  return {
    /** Calls an entry through the Port, as a Command or the Edit Drawer would. */
    call,
    until(matches: (answer: Days) => boolean): Promise<Days> {
      return new Promise((resolve) => {
        const check = () => {
          if (days === undefined || !matches(days)) return;
          waiting.delete(check);
          resolve(days);
        };
        waiting.add(check);
        check();
      });
    },
  };
}

const content = (days: Days) =>
  days.status === "content" || days.status === "reloading" ? days.data : undefined;

test("an entry created, edited, deleted and restored through the Port follows in the open week, and a renamed project with it, through the Table Change alone", async () => {
  let project = { id: "" };
  const week = await renderWeek(async (call) => {
    project = (await call("projects", "create", { title: "Website" })) as { id: string };
  });
  const empty = content(await week.until((days) => days.status === "content"));
  expect(empty?.days.map(({ total }) => total)).toEqual([0, 0, 0, 0, 0, 0, 0]);

  const entry = (await week.call("timeTracking", "create", {
    startedAt: "2026-11-18T21:00:00.000Z",
    endedAt: "2026-11-19T00:30:00.000Z",
    projects: [{ projectId: project.id }],
    note: "Release",
  })) as { id: string };

  const created = content(
    await week.until((days) => days.status === "content" && days.data.total === 12_600),
  );
  // 22:00 to 01:30 in Berlin: Wednesday and Thursday, each with its Day Share.
  expect(created?.days.map(({ total }) => total)).toEqual([0, 0, 7200, 5400, 0, 0, 0]);
  expect(created?.days[3]?.entries).toMatchObject([
    { note: "Release", crossesMidnight: true, projects: [{ project: { title: "Website" } }] },
  ]);

  await week.call("projects", "edit", { id: project.id, title: "Shop" });
  const renamed = content(
    await week.until(
      (days) => days.status === "content" && days.data.projects[0]?.project?.title === "Shop",
    ),
  );
  expect(asWorkEntry(renamed!.days[2]!.entries[0]!).projects[0]?.project.title).toBe("Shop");

  // 22:00 to 23:00 on Wednesday alone: the entry no longer crosses midnight.
  await week.call("timeTracking", "edit", {
    id: entry.id,
    startedAt: "2026-11-18T21:00:00.000Z",
    endedAt: "2026-11-18T22:00:00.000Z",
  });
  const edited = content(
    await week.until((days) => days.status === "content" && days.data.total === 3600),
  );
  expect(edited?.days.map(({ total }) => total)).toEqual([0, 0, 3600, 0, 0, 0, 0]);
  expect(edited?.days[2]?.entries).toMatchObject([{ crossesMidnight: false }]);

  await week.call("timeTracking", "delete", { id: entry.id });
  const deleted = content(
    await week.until((days) => days.status === "content" && days.data.total === 0),
  );
  expect(deleted?.days[2]?.entries).toEqual([]);

  await week.call("timeTracking", "restore", { id: entry.id });
  const restored = content(
    await week.until((days) => days.status === "content" && days.data.total === 3600),
  );
  expect(restored?.days[2]?.entries).toMatchObject([
    { note: "Release", projects: [{ project: { title: "Shop" } }] },
  ]);
});
