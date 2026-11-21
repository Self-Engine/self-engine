// @vitest-environment happy-dom
// The timer's Module Indicator (#349) and its Indicator Panel (#350) end to end without the app:
// the Shell with `projects` and `time-tracking`, over the real client, building block and test
// Data Process, in Berlin with a Data Process Clock the test moves and a page Clock it sets apart.
// The indicator shows the running timer, stops it with one click and opens the panel; the panel
// edits the timer, stops it at a chosen time and discards it. No fake answers: each step waits for
// the page it expects. How both look at each Layout Step the stories show.

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { createDataConnection } from "@self-engine/data-client";
import {
  type DataAccess,
  DataProvider,
  portAccessOf,
  refusalTexts,
  useDataAccess,
} from "@self-engine/data-client/react";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { createTestSources } from "@self-engine/db/testing";
import { contribution as projectsContribution } from "@self-engine/projects";
import { projects } from "@self-engine/projects/data";
import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { Shell, type ShellRouting, type ViewAddress, type ViewSearch } from "@self-engine/shell";
import { type Clock, resolveTimeZone } from "@self-engine/time";
import { PageClockProvider, TimeSettingsProvider } from "@self-engine/time/react";
import { alwaysVisible, fixedClock, requireInstant } from "@self-engine/time/testing";
import { FeedbackHost } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { timeTracking } from "./data/index.ts";
import { contribution } from "./index.ts";
import { startTimerAndTell, stopTimerAndTell } from "./timer-actions.tsx";

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
/** The Data Process's "now" when each test begins: Friday 20 November 2026, 10:00 in Berlin. */
const NOW = "2026-11-20T09:00:00.000Z";

// The Shell loads the indicator and the panel in an idle moment, which Happy DOM puts a second off.
vi.setConfig({ testTimeout: 20_000 });

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  clearNotices();
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

type Client = ContractRouterClient<{
  projects: typeof projects.contract;
  timeTracking: typeof timeTracking.contract;
}>;

/** The calls of the timer's Operations that reached the Port, in order. */
interface Call {
  readonly entry: string;
  readonly input: unknown;
}

const OPERATIONS = new Set([
  "startTimer",
  "editTimer",
  "stopTimer",
  "discardTimer",
  "undoStopTimer",
  "undoDiscardTimer",
]);

interface Setup {
  readonly client: Client;
  readonly process: TestDataProcess;
  readonly clock: ReturnType<typeof createTestSources>;
}

const tableName = (table: string) =>
  projectsContribution.dataTexts?.tableNames[table] ?? contribution.dataTexts?.tableNames[table];

/** Happy DOM's handle on the window, whose viewport its answers to the Shell's media queries follow. */
function happyDOM(): { setViewport: (viewport: { width: number; height: number }) => void } {
  const handle: unknown = Reflect.get(window, "happyDOM");
  if (typeof handle !== "object" || handle === null || !("setViewport" in handle))
    throw new Error("These tests run in Happy DOM");
  return handle as ReturnType<typeof happyDOM>;
}

/** The window's width: the Shell shows the indicator's full form when wide, its short one on a phone. */
const WIDTHS = { full: 1440, short: 390 } as const;

/**
 * The Shell on the projects' page with the timer's indicator in the content header, over the test
 * Data Process, after `setup`. The page's Clock stands at `pageNow` (the Data Process's "now"
 * unless a test says else).
 */
async function renderShell({
  form = "full",
  pageNow = NOW,
  setup = async () => {},
}: {
  readonly form?: keyof typeof WIDTHS;
  readonly pageNow?: string;
  readonly setup?: (setup: Setup) => Promise<void>;
} = {}) {
  happyDOM().setViewport({ width: WIDTHS[form], height: 800 });
  const clock = createTestSources(NOW);
  const process = await startTestDataProcess({
    modules: { projects, timeTracking },
    deviceZone: BERLIN,
    sources: clock,
  });
  cleanups.push(() => process.close());
  const client = createORPCClient<Client>(new RPCLink({ port: process.openPort() }));
  await setup({ client, process, clock });
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  const real = portAccessOf(connection);
  const calls: Call[] = [];
  const access = {
    ...real,
    call: (module: string, entry: string, input: unknown, signal?: AbortSignal) => {
      if (OPERATIONS.has(entry)) calls.push({ entry, input });
      return real.call(module, entry, input, signal);
    },
  };
  // The first timer the setup started, which the tests name in the calls they expect.
  const [first] = await client.timeTracking.runningTimers();
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: ({ error }) => {
      throw error;
    },
  });
  await store.load();
  let search: ViewSearch = {};
  const listeners = new Set<() => void>();
  const address: ViewAddress = {
    search: () => search,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    writeSearch: (update) => {
      search = update(search);
      for (const listener of listeners) listener();
    },
    scopedWriteSearch: () => address.writeSearch,
  };
  const routing: ShellRouting = {
    useAddress: () => address,
    useGoToView: () => async () => true,
    useLeaveGuard: () => {},
    Link: ({ to, search: _search, ...props }) => createElement("a", { ...props, href: to }),
  };
  function TimerShell() {
    return createElement(Shell, {
      activeModule: projectsContribution,
      activeView: projectsContribution.views[0],
      contributions: [contribution, projectsContribution],
      settings: {
        id: "settings",
        name: { id: "test-settings", message: "Settings" },
        icon: contribution.icon,
        color: contribution.color,
        views: contribution.views,
      },
      data: useDataAccess(),
      routing,
      onModuleSidebarCollapsedCommit: () => {},
      onModuleSidebarWidthCommit: () => {},
      onNavbarCommit: () => {},
      children: null,
    });
  }
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
  const i18n = setupI18n({ locale: "de", messages: { de: {} } });
  let pageClock: Clock = fixedClock(requireInstant(pageNow));
  const page = createElement(PageClockProvider, {
    clock: () => pageClock(),
    visibility: alwaysVisible,
    children: createElement(TimeSettingsProvider, {
      store,
      deviceZone: BERLIN,
      region: "de-DE",
      onError: () => {},
      children: createElement(
        DataProvider,
        { access, reasonTexts: refusalTexts([], tableName) },
        createElement(TimerShell),
      ),
    }),
  });
  root.render(
    createElement(
      I18nProvider,
      { i18n },
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(FeedbackHost, { children: page }),
      ),
    ),
  );
  /** What a Command is given: the same access and seams as the page (D261). */
  const data: DataAccess = { access, notify: () => {}, notifyRefused: () => {} };
  return {
    client,
    clock,
    calls,
    data,
    timerId: () => first?.id,
    setPageNow: (instant: string) => {
      pageClock = fixedClock(requireInstant(instant));
    },
  };
}

/**
 * Waits until the page shows what the check expects. The indicator's and the panel's code load in
 * an idle moment, which Happy DOM puts a second off.
 */
const shown = <Value>(check: () => Value | Promise<Value>) => vi.waitFor(check, { timeout: 4_000 });

function button(within: Element, label: string | RegExp) {
  const found = [...within.querySelectorAll("button")].find((item) => {
    const name = item.getAttribute("aria-label") ?? item.textContent ?? "";
    return typeof label === "string" ? name === label : label.test(name);
  });
  if (found === undefined) throw new Error(`Missing ${String(label)} button`);
  return found;
}

/** The open Indicator Panel, named after the module. */
function panel() {
  const found = document.querySelector('[role="dialog"][aria-label="Time"]');
  if (found === null) throw new Error("The panel is closed");
  return found;
}

const panelClosed = () => document.querySelector('[role="dialog"][aria-label="Time"]') === null;

/** Opens the panel from the indicator, once the indicator and its form arrived. */
async function openPanel() {
  const opener = await shown(() => button(document.body, /^Edit timer/));
  opener.click();
  await shown(() => expect(panel().querySelector("textarea")).not.toBeNull());
  return opener;
}

const setValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  // React reads the value through the input's own setter, as typing sets it.
  const prototype = Object.getPrototypeOf(input) as object;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const note = () => panel().querySelector<HTMLTextAreaElement>("textarea")!;

/** The hours and minutes of the panel's time: the start in the form, the end at "Stop at …". */
function panelTime() {
  const [hours, minutes] = [
    ...panel().querySelectorAll<HTMLInputElement>('input[role="spinbutton"]'),
  ];
  if (minutes === undefined) throw new Error("Missing time inputs");
  return { hours: hours!, minutes };
}
const startTime = panelTime;
const endTime = panelTime;

/** Types `HH:MM` into a time's hours and minutes. */
async function typeTime({ hours, minutes }: ReturnType<typeof panelTime>, time: string) {
  const [hh, mm] = time.split(":");
  setValue(hours, hh!);
  setValue(minutes, mm!);
  // The picker reports a part it holds after the input has been drawn.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The panel's project picker. */
function picker() {
  const input = [...panel().querySelectorAll<HTMLInputElement>("input")].find(
    (item) => item.closest(".mantine-Select-root") !== null,
  );
  if (input === undefined) throw new Error("Missing the project picker");
  return input;
}

/** Picks a project in the panel's picker, as a click on its option does. */
async function pick(title: string) {
  const input = picker();
  input.click();
  const option = await shown(() => {
    const list = document.getElementById(input.getAttribute("aria-controls") ?? "");
    const found = [...(list?.querySelectorAll('[role="option"]') ?? [])].find(
      (item) => item.textContent === title,
    );
    expect(found).toBeDefined();
    return found as HTMLElement;
  });
  option.click();
  await shown(() => expect(input.value).toBe(title));
}

/** Saves the panel's form and waits until a successful save closed it. */
async function save() {
  await shown(() => expect(button(panel(), "Save").disabled).toBe(false));
  button(panel(), "Save").click();
  await shown(() => expect(panelClosed()).toBe(true));
}

/** The running time as the indicator shows it, or undefined while none runs. */
const runningTime = () => document.querySelector('[role="timer"]')?.textContent ?? undefined;

/** What the indicator's opener shows: the project's title, the running time and the count. */
const opener = () => button(document.body, /^Edit timer/);

/** The texts of the Notices on screen. */
const notices = () =>
  [...document.querySelectorAll(".mantine-Notification-description")].map(
    (notice) => notice.textContent ?? "",
  );

test("a timer started before the app was closed shows its full running time at the first render", async () => {
  await renderShell({
    // The app was closed for three hours, a quarter and seven seconds.
    pageNow: "2026-11-20T12:15:07.000Z",
    setup: async ({ client }) => {
      const project = await client.projects.create({ title: "Website", icon: "house" });
      await client.timeTracking.startTimer({ projectId: project.id });
    },
  });
  await shown(() => expect(runningTime()).toBe("3:15:07"));
  expect(opener().textContent).toContain("Website");
  expect(button(document.body, "Stop timer")).toBeDefined();
});

test("the short form shows the running time and the stop button, without the project", async () => {
  await renderShell({
    form: "short",
    pageNow: "2026-11-20T09:00:42.000Z",
    setup: async ({ client }) => {
      const project = await client.projects.create({ title: "Website" });
      await client.timeTracking.startTimer({ projectId: project.id });
    },
  });
  await shown(() => expect(runningTime()).toBe("0:00:42"));
  expect(opener().textContent).not.toContain("Website");
  expect(button(document.body, "Stop timer")).toBeDefined();
});

test("one click stops the timer, a Notice confirms the entry, and Undo lets the timer run again", async () => {
  const { client, clock } = await renderShell({
    pageNow: "2026-11-20T09:30:00.000Z",
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({ note: "Design" });
      clock.advance(30 * 60_000);
    },
  });
  await shown(() => expect(runningTime()).toBe("0:30:00"));

  button(document.body, "Stop timer").click();
  await shown(() => expect(button(document.body, "Start timer")).toBeDefined());
  expect(notices()).toEqual(["Time entry savedUndo"]);
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);

  clock.advance(60_000);
  button(document.body, "Undo").click();
  // The timer runs on with its original start.
  await shown(() => expect(runningTime()).toBe("0:30:00"));
  await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
    { startedAt: NOW, note: "Design" },
  ]);
});

test("with no timer running, one click starts one without a project, and no Notice follows", async () => {
  const { client } = await renderShell();
  const start = await shown(() => button(document.body, "Start timer"));
  start.click();
  await shown(() => expect(runningTime()).toBe("0:00:00"));
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
      started_at: "2026-11-20T08:00:00.000Z",
      project_id: null,
    })
    .execute();
}

test("with two running timers it shows the latest and a count, and one click stops the latest", async () => {
  await renderShell({
    pageNow: "2026-11-20T09:00:05.000Z",
    setup: async (setup) => {
      await twoRunning(setup);
      setup.clock.advance(5_000);
    },
  });
  await shown(() => expect(runningTime()).toBe("0:00:05"));
  expect(opener().textContent).toContain("Website");
  expect(document.querySelector('[aria-label="2 timers running"]')?.textContent).toBe("2");

  button(document.body, "Stop timer").click();
  // The one started at nine runs on, alone, without a count.
  await shown(() => expect(runningTime()).toBe("1:00:05"));
  expect(document.querySelector('[aria-label$="timers running"]')).toBeNull();
  expect(opener().textContent).not.toContain("Website");
});

test("a stop within the same second says that nothing was saved", async () => {
  await renderShell({
    setup: async ({ client }) => {
      await client.timeTracking.startTimer({});
    },
  });
  await shown(() => expect(runningTime()).toBe("0:00:00"));
  button(document.body, "Stop timer").click();
  await shown(() => expect(button(document.body, "Start timer")).toBeDefined());
  expect(notices()).toEqual(["Stopped within the same second: nothing was saved."]);
});

test('a stop while the clock lies before the start keeps the timer, and its Notice leads to "Stop at …"', async () => {
  const { client, clock, calls } = await renderShell({
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({});
      // The computer's clock jumped back an hour.
      clock.advance(-3_600_000);
    },
  });
  await shown(() => expect(runningTime()).toBe("0:00:00"));
  button(document.body, "Stop timer").click();
  await shown(() =>
    expect(notices()).toEqual([
      "The clock shows a time before the timer's start. The timer keeps running.Stop at …",
    ]),
  );
  await expect(client.timeTracking.runningTimers()).resolves.toHaveLength(1);
  expect(runningTime()).toBe("0:00:00");

  // The Notice's action opens the panel at "Stop at …".
  button(document.querySelector(".mantine-Notification-root")!, "Stop at …").click();
  await shown(() => expect(button(panel(), "Stop")).toBeDefined());
  expect(panel().textContent).toContain("Running since");
  // 10:30 in Berlin lies after the start, but after the Data Process's "now" as well.
  await typeTime(endTime(), "10:30");
  button(panel(), "Stop").click();
  await shown(() => expect(panel().textContent).toContain("The end cannot lie in the future."));
  expect(calls.at(-1)).toMatchObject({
    entry: "stopTimer",
    input: { endedAt: "2026-11-20T09:30:00.000Z" },
  });

  // Once the clock is right again, the same end stops the timer there.
  clock.advance(2 * 3_600_000);
  button(panel(), "Stop").click();
  await shown(() => expect(panelClosed()).toBe(true));
  await shown(() => expect(notices()).toContain("Time entry savedUndo"));
  await expect(client.timeTracking.runningTimers()).resolves.toEqual([]);
});

test("a start that stopped another timer says that its entry was saved, also from outside React", async () => {
  const { data, clock } = await renderShell({
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({});
      clock.advance(60_000);
    },
  });
  await shown(() => expect(runningTime()).toBe("0:00:00"));
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

test("the panel edits the note of the running timer, sends only the note and closes", async () => {
  const shell = await renderShell({
    setup: async ({ client }) => {
      await client.timeTracking.startTimer({ note: "Design" });
    },
  });
  const opener = await openPanel();
  expect(opener.getAttribute("aria-expanded")).toBe("true");
  expect(opener.getAttribute("aria-haspopup")).toBe("dialog");
  expect(note().value).toBe("Design");

  setValue(note(), "Design review");
  await shown(() => expect(button(panel(), "Save").disabled).toBe(false));
  button(panel(), "Save").click();

  await shown(() => expect(panelClosed()).toBe(true));
  const [timer] = await shell.client.timeTracking.runningTimers();
  expect(shell.calls).toEqual([
    { entry: "editTimer", input: { id: timer?.id, note: "Design review" } },
  ]);
  expect(timer?.note).toBe("Design review");
});

test("a project can be set, changed and cleared, and the indicator shows each at once", async () => {
  let ids: Record<string, string> = {};
  const shell = await renderShell({
    setup: async ({ client }) => {
      const website = await client.projects.create({ title: "Website" });
      const shop = await client.projects.create({ title: "Shop" });
      ids = { website: website.id, shop: shop.id };
      await client.timeTracking.startTimer({});
    },
  });
  await openPanel();
  await pick("Website");
  await save();
  await shown(() => expect(opener().textContent).toContain("Website"));

  await openPanel();
  await pick("Shop");
  await save();
  await shown(() => expect(opener().textContent).toContain("Shop"));

  await openPanel();
  button(panel(), "Clear the choice").click();
  await save();
  await shown(() => expect(opener().textContent).not.toContain("Shop"));

  const [timer] = await shell.client.timeTracking.runningTimers();
  expect(shell.calls).toEqual([
    { entry: "editTimer", input: { id: timer?.id, projectId: ids["website"] } },
    { entry: "editTimer", input: { id: timer?.id, projectId: ids["shop"] } },
    { entry: "editTimer", input: { id: timer?.id, projectId: null } },
  ]);
});

test("a note can be cleared, and an emptied note is sent as none", async () => {
  const shell = await renderShell({
    setup: async ({ client }) => {
      await client.timeTracking.startTimer({ note: "Design" });
    },
  });
  await openPanel();
  setValue(note(), "  ");
  await save();
  const [timer] = await shell.client.timeTracking.runningTimers();
  expect(timer?.note).toBeNull();
  expect(shell.calls).toEqual([{ entry: "editTimer", input: { id: timer?.id, note: null } }]);
});

test("the start can be moved back; one in the future shows its message at the start", async () => {
  const shell = await renderShell({
    pageNow: "2026-11-20T09:30:00.000Z",
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({});
      clock.advance(30 * 60_000);
    },
  });
  await openPanel();
  // 11:00 in Berlin lies after the Data Process's "now" of 10:30.
  await typeTime(startTime(), "11:00");
  button(panel(), "Save").click();
  await shown(() => expect(panel().textContent).toContain("The start cannot lie in the future."));
  await expect(shell.client.timeTracking.runningTimers()).resolves.toMatchObject([
    { startedAt: NOW },
  ]);

  await typeTime(startTime(), "09:15");
  // A changed start answers the message at it.
  await shown(() =>
    expect(panel().textContent).not.toContain("The start cannot lie in the future."),
  );
  await save();
  await shown(() => expect(runningTime()).toBe("1:15:00"));
  const [timer] = await shell.client.timeTracking.runningTimers();
  expect(shell.calls).toEqual([
    { entry: "editTimer", input: { id: timer?.id, startedAt: "2026-11-20T10:00:00.000Z" } },
    { entry: "editTimer", input: { id: timer?.id, startedAt: "2026-11-20T08:15:00.000Z" } },
  ]);
});

test('"Stop at …" stops the timer at the end typed; an end before the start shows its message there', async () => {
  const shell = await renderShell({
    pageNow: "2026-11-20T11:00:00.000Z",
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({ note: "Design" });
      clock.advance(2 * 3_600_000);
    },
  });
  await openPanel();
  button(panel(), "Stop at …").click();
  await shown(() => expect(button(panel(), "Stop")).toBeDefined());

  // 09:30 in Berlin lies before the start of 10:00.
  await typeTime(endTime(), "09:30");
  button(panel(), "Stop").click();
  await shown(() => expect(panel().textContent).toContain("The end must lie after the start."));

  await typeTime(endTime(), "11:45");
  button(panel(), "Stop").click();
  await shown(() => expect(panelClosed()).toBe(true));
  await shown(() => expect(notices()).toEqual(["Time entry savedUndo"]));
  await shown(() => expect(button(document.body, "Start timer")).toBeDefined());
  const id = shell.timerId();
  expect(shell.calls).toEqual([
    { entry: "stopTimer", input: { id, endedAt: "2026-11-20T08:30:00.000Z" } },
    { entry: "stopTimer", input: { id, endedAt: "2026-11-20T10:45:00.000Z" } },
  ]);

  // "Undo" lets the timer run again with its original start.
  button(document.body, "Undo").click();
  await shown(() => expect(runningTime()).toBe("2:00:00"));
});

test('"Discard" removes the timer, and "Undo" lets it run again with its original start', async () => {
  const shell = await renderShell({
    pageNow: "2026-11-20T09:20:00.000Z",
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({ note: "Design" });
      clock.advance(20 * 60_000);
    },
  });
  await openPanel();
  button(panel(), "Discard").click();
  await shown(() => expect(panelClosed()).toBe(true));
  await shown(() => expect(notices()).toEqual(["Timer discardedUndo"]));
  await shown(() => expect(button(document.body, "Start timer")).toBeDefined());
  await expect(shell.client.timeTracking.runningTimers()).resolves.toEqual([]);

  button(document.body, "Undo").click();
  await shown(() => expect(runningTime()).toBe("0:20:00"));
  await expect(shell.client.timeTracking.runningTimers()).resolves.toMatchObject([
    { startedAt: NOW, note: "Design" },
  ]);
  const id = shell.timerId();
  expect(shell.calls).toEqual([
    { entry: "discardTimer", input: { id } },
    { entry: "undoDiscardTimer", input: { id } },
  ]);
});

test("an archived project the timer carries shows as archived in the picker", async () => {
  await renderShell({
    setup: async ({ client }) => {
      const project = await client.projects.create({ title: "Old site" });
      await client.timeTracking.startTimer({ projectId: project.id });
      await client.projects.archive({ id: project.id });
    },
  });
  await openPanel();
  await shown(() => expect(picker().value).toBe("Old site (archived)"));
});

test("closing the panel with unsaved changes asks first; keeping them leaves the panel open", async () => {
  await renderShell({
    setup: async ({ client }) => {
      await client.timeTracking.startTimer({ note: "Design" });
    },
  });
  const openedBy = await openPanel();
  setValue(note(), "Design review");
  button(panel(), "Cancel").click();
  const question = await shown(() => {
    const found = [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
      dialog.textContent?.includes("Discard changes?"),
    );
    if (found === undefined) throw new Error("No question");
    return found;
  });
  button(question, "Keep editing").click();
  await shown(() => expect(document.body.textContent).not.toContain("Discard changes?"));
  expect(note().value).toBe("Design review");

  // A second click on the indicator is a way out too, and asks the same.
  openedBy.click();
  const again = await shown(() => {
    const found = [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
      dialog.textContent?.includes("Discard changes?"),
    );
    if (found === undefined) throw new Error("No question");
    return found;
  });
  button(again, "Discard").click();
  await shown(() => expect(panelClosed()).toBe(true));
});

test("when the panel's timer stops elsewhere, the panel says so and turns to no other timer", async () => {
  const shell = await renderShell({
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({ note: "Design" });
      clock.advance(60_000);
    },
  });
  await openPanel();
  // A Command starts another timer, which stops the one the panel edits.
  await shell.client.timeTracking.startTimer({ note: "Mail" });
  await shown(() => expect(panel().textContent).toContain("This timer is no longer running."));
  button(panel(), "Close").click();
  await shown(() => expect(panelClosed()).toBe(true));
});

test('"Stop at …" from a Notice keeps the open panel open when it shows no timer', async () => {
  const shell = await renderShell({
    setup: async ({ client, clock }) => {
      await client.timeTracking.startTimer({});
      // The computer's clock jumped back an hour.
      clock.advance(-3_600_000);
    },
  });
  await shown(() => expect(runningTime()).toBe("0:00:00"));
  button(document.body, "Stop timer").click();
  const stopAt = await shown(() =>
    button(document.querySelector(".mantine-Notification-root")!, "Stop at …"),
  );
  await openPanel();
  // The clock is right again, and the timer stops elsewhere while the panel is open.
  shell.clock.advance(2 * 3_600_000);
  await shell.client.timeTracking.stopTimer({ id: shell.timerId()! });
  await shown(() => expect(panel().textContent).toContain("This timer is no longer running."));

  stopAt.click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(panelClosed()).toBe(false);
  expect(panel().textContent).toContain("This timer is no longer running.");
});
