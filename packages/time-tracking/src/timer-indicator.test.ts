// @vitest-environment happy-dom
// The timer's Module Indicator end to end without the app (#349): drawn over the real client,
// building block and test Data Process with `projects` and `time-tracking` mounted, with a page
// Clock and a Data Process Clock the test sets apart. No fake answers: each step waits for the
// page it expects. How it looks at each Layout Step the stories show.

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { createDataConnection } from "@self-engine/data-client";
import { type DataAccess, DataProvider, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { createTestSources } from "@self-engine/db/testing";
import { projects } from "@self-engine/projects/data";
import type { IndicatorForm } from "@self-engine/shell";
import { type Clock, resolveTimeZone } from "@self-engine/time";
import { PageClockProvider } from "@self-engine/time/react";
import { alwaysVisible, fixedClock, requireInstant } from "@self-engine/time/testing";
import { FeedbackHost } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { timeTracking } from "./data/index.ts";
import Indicator from "./indicator/index.tsx";
import { startTimerAndTell, stopTimerAndTell } from "./timer-actions.tsx";

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  clearNotices();
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

type Client = ContractRouterClient<{
  projects: typeof projects.contract;
  timeTracking: typeof timeTracking.contract;
}>;

/** The Data Process's "now" when each test begins: Monday 16 November 2026, 10:00 in Berlin. */
const NOW = "2026-11-16T09:00:00.000Z";

interface Setup {
  readonly client: Client;
  readonly process: TestDataProcess;
  readonly clock: ReturnType<typeof createTestSources>;
}

/**
 * The indicator in `form` over the test Data Process, after `setup`, with the page's Clock at
 * `pageNow` (the Data Process's "now" unless a test says else).
 */
async function renderIndicator({
  form = "full",
  pageNow = NOW,
  setup = async () => {},
}: {
  readonly form?: IndicatorForm;
  readonly pageNow?: string;
  readonly setup?: (setup: Setup) => Promise<void>;
} = {}) {
  const clock = createTestSources(NOW);
  const process = await startTestDataProcess({
    modules: { projects, timeTracking },
    deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
    sources: clock,
  });
  cleanups.push(() => process.close());
  const client = createORPCClient<Client>(new RPCLink({ port: process.openPort() }));
  await setup({ client, process, clock });
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  const data: DataAccess = {
    access: portAccessOf(connection),
    notify: () => {},
    notifyRefused: () => {},
  };
  // Happy DOM lacks the browser's FontFaceSet. Mantine listens for font loads on it.
  Object.defineProperty(document, "fonts", { configurable: true, value: new EventTarget() });
  cleanups.push(() => {
    Reflect.deleteProperty(document, "fonts");
  });
  const container = document.createElement("div");
  document.body.append(container);
  cleanups.push(() => container.remove());
  const root = createRoot(container);
  cleanups.push(() => root.unmount());
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  i18n.activate("en");
  let pageClock: Clock = fixedClock(requireInstant(pageNow));
  root.render(
    createElement(
      I18nProvider,
      { i18n },
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(FeedbackHost, {
          children: createElement(PageClockProvider, {
            clock: () => pageClock(),
            visibility: alwaysVisible,
            children: createElement(DataProvider, data, createElement(Indicator, { form })),
          }),
        }),
      ),
    ),
  );
  return {
    client,
    clock,
    container,
    data,
    process,
    setPageNow: (instant: string) => {
      pageClock = fixedClock(requireInstant(instant));
    },
  };
}

/** Waits until the page shows what the check expects. */
const shown = <Value>(check: () => Value | Promise<Value>) => vi.waitFor(check, { timeout: 4_000 });

function button(within: Element, name: string) {
  const found = [...within.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent === name,
  );
  if (found === undefined) throw new Error(`Missing ${name} button`);
  return found;
}

/** The running time as the indicator shows it, or undefined while none runs. */
const runningTime = (container: Element) =>
  container.querySelector('[role="timer"]')?.textContent ?? undefined;

/** The texts of the Notices on screen. */
const notices = () =>
  [...document.querySelectorAll(".mantine-Notification-description")].map(
    (notice) => notice.textContent ?? "",
  );

test("a timer started before the app was closed shows its full running time at the first render", async () => {
  const { container } = await renderIndicator({
    // The app was closed for three hours, a quarter and seven seconds.
    pageNow: "2026-11-16T12:15:07.000Z",
    setup: async ({ client }) => {
      const project = await client.projects.create({ title: "Website", icon: "house" });
      await client.timeTracking.startTimer({ projectId: project.id });
    },
  });
  await shown(() => expect(runningTime(container)).toBe("3:15:07"));
  expect(container.textContent).toContain("Website");
  expect(button(container, "Stop timer")).toBeDefined();
});

test("the short form shows the running time and the stop button, without the project", async () => {
  const { container } = await renderIndicator({
    form: "short",
    pageNow: "2026-11-16T09:00:42.000Z",
    setup: async ({ client }) => {
      const project = await client.projects.create({ title: "Website" });
      await client.timeTracking.startTimer({ projectId: project.id });
    },
  });
  await shown(() => expect(runningTime(container)).toBe("0:00:42"));
  expect(container.textContent).not.toContain("Website");
  expect(button(container, "Stop timer")).toBeDefined();
});

test("one click stops the timer, a Notice confirms the entry, and Undo lets the timer run again", async () => {
  const { container, client, clock } = await renderIndicator({
    pageNow: "2026-11-16T09:30:00.000Z",
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({ note: "Design" });
      clock.advance(30 * 60_000);
    },
  });
  await shown(() => expect(runningTime(container)).toBe("0:30:00"));

  button(container, "Stop timer").click();
  await shown(() => expect(button(container, "Start timer")).toBeDefined());
  expect(notices()).toEqual(["Time entry savedUndo"]);
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);

  clock.advance(60_000);
  button(document.body, "Undo").click();
  // The timer runs on with its original start.
  await shown(() => expect(runningTime(container)).toBe("0:30:00"));
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { startedAt: NOW, note: "Design" },
  ]);
});

test("with no timer running, one click starts one without a project, and no Notice follows", async () => {
  const { container, client } = await renderIndicator();
  const start = await shown(() => button(container, "Start timer"));
  start.click();
  await shown(() => expect(runningTime(container)).toBe("0:00:00"));
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { startedAt: NOW, projectId: null, note: null },
  ]);
  expect(notices()).toEqual([]);
});

/** Two running timers, as a sync would leave them: one started at nine, the other at ten. */
async function twoRunning({ client, process }: Setup) {
  const project = await client.projects.create({ title: "Website" });
  await client.timeTracking.startTimer({ projectId: project.id });
  const rows = process.database.kysely.withTables<{ timers: Record<string, string | null> }>();
  const [stored] = await rows.selectFrom("timers").selectAll().execute();
  await rows
    .insertInto("timers")
    .values({
      ...stored,
      id: "01a1cfa1-0b00-7000-8000-0000000000aa",
      started_at: "2026-11-16T08:00:00.000Z",
      project_id: null,
    })
    .execute();
}

test("with two running timers it shows the latest and a count, and one click stops the latest", async () => {
  const { container } = await renderIndicator({
    pageNow: "2026-11-16T09:00:05.000Z",
    setup: async (setup) => {
      await twoRunning(setup);
      setup.clock.advance(5_000);
    },
  });
  await shown(() => expect(runningTime(container)).toBe("0:00:05"));
  expect(container.textContent).toContain("Website");
  expect(container.querySelector('[aria-label="2 timers running"]')?.textContent).toBe("2");

  button(container, "Stop timer").click();
  // The one started at nine runs on, alone, without a count.
  await shown(() => expect(runningTime(container)).toBe("1:00:05"));
  expect(container.querySelector('[aria-label$="timers running"]')).toBeNull();
  expect(container.textContent).not.toContain("Website");
});

test("a stop within the same second says that nothing was saved", async () => {
  const { container } = await renderIndicator({
    setup: async ({ client }) => {
      await client.timeTracking.startTimer({});
    },
  });
  await shown(() => expect(runningTime(container)).toBe("0:00:00"));
  button(container, "Stop timer").click();
  await shown(() => expect(button(container, "Start timer")).toBeDefined());
  expect(notices()).toEqual(["Stopped within the same second: nothing was saved."]);
});

test("a stop while the clock lies before the start says that the timer keeps running", async () => {
  const { container, client } = await renderIndicator({
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({});
      // The computer's clock jumped back an hour.
      clock.advance(-3_600_000);
    },
  });
  await shown(() => expect(runningTime(container)).toBe("0:00:00"));
  button(container, "Stop timer").click();
  await shown(() =>
    expect(notices()).toEqual([
      "The clock shows a time before the timer's start. The timer keeps running.",
    ]),
  );
  await expect(client.timeTracking.runningTimers()).resolves.toHaveLength(1);
  expect(runningTime(container)).toBe("0:00:00");
});

test("a start that stopped another timer says that its entry was saved, also from outside React", async () => {
  const { container, data, clock } = await renderIndicator({
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({});
      clock.advance(60_000);
    },
  });
  await shown(() => expect(runningTime(container)).toBe("0:00:00"));
  // As a Command would: with the Port access and seams it was given (D261).
  const started = await startTimerAndTell(data, { note: "Mail" });
  expect(started).toMatchObject({ status: "success", data: { others: [{ kind: "saved" }] } });
  await shown(() =>
    expect(notices()).toEqual(["The running timer was stopped and its time entry saved."]),
  );
  clock.advance(1_000);
  if (started.status !== "success") return;
  await expect(stopTimerAndTell(data, started.data.timer.id)).resolves.toMatchObject({
    status: "success",
    data: { kind: "saved" },
  });
});
