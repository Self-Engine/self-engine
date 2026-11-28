// @vitest-environment happy-dom
// End to end without the app (#33): the week View, its Edit Drawer and the module's Commands over
// the real client, building block and test Data Process with `projects` and `time-tracking`
// mounted, in Berlin with a fixed Clock (Friday 20 November 2026). The page speaks German, whose
// clock counts 24 hours, with the English source texts. No fake answers: each step waits for the
// page it expects. That the drawer shows its values as a person sees them is shown by the stories.

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { createTestSources } from "@self-engine/db/testing";
import { createDataConnection } from "@self-engine/data-client";
import {
  type DataAccess,
  DataProvider,
  portAccessOf,
  refusalTexts,
  useDataAccess,
} from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { contribution as projectsContribution } from "@self-engine/projects";
import { projects } from "@self-engine/projects/data";
import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import {
  runCommand,
  Shell,
  type ShellRouting,
  type ViewAddress,
  type ViewSearch,
} from "@self-engine/shell";
import { resolveTimeZone } from "@self-engine/time";
import { PageClockProvider, TimeSettingsProvider } from "@self-engine/time/react";
import { alwaysVisible, fixedClock, requireInstant } from "@self-engine/time/testing";
import { FeedbackHost, undoLatest } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { timeTracking } from "./data/index.ts";
import { contribution } from "./index.ts";
import Week from "./week.tsx";

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
/** Friday 20 November 2026, 11:00 in Berlin. */
const FRIDAY_MORNING = fixedClock(requireInstant("2026-11-20T10:00:00.000Z"));

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  clearNotices();
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

type Client = ContractRouterClient<{
  projects: typeof projects.contract;
  timeTracking: typeof timeTracking.contract;
}>;

const OPERATIONS = new Set(["create", "edit", "delete", "restore"]);

/** The calls of Operations that reached the Port, in order; Queries and Clearances are left out. */
interface Call {
  readonly entry: string;
  readonly input: unknown;
}

/** The table names of both modules, as the app's module list hands them to the texts. */
const tableName = (table: string) =>
  projectsContribution.dataTexts?.tableNames[table] ?? contribution.dataTexts?.tableNames[table];

/** The week of Friday 20 November 2026 with its Edit Drawer, over the test Data Process. */
async function renderWeek(setup: (client: Client) => Promise<void> = async () => {}) {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking },
    deviceZone: BERLIN,
    sources: createTestSources(FRIDAY_MORNING()),
  });
  cleanups.push(() => process.close());
  const client = createORPCClient<Client>(new RPCLink({ port: process.openPort() }));
  await setup(client);
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
  const reasonTexts = refusalTexts([], tableName);
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
  let showProjects: (show: boolean) => void;
  function WeekShell() {
    const [showingProjects, setShowingProjects] = useState(false);
    showProjects = setShowingProjects;
    const activeModule = showingProjects ? projectsContribution : contribution;
    return createElement(Shell, {
      activeModule,
      activeView: activeModule.views[0],
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
      children: showingProjects ? null : createElement(Week),
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
  const page = createElement(PageClockProvider, {
    clock: FRIDAY_MORNING,
    visibility: alwaysVisible,
    children: createElement(TimeSettingsProvider, {
      store,
      deviceZone: BERLIN,
      region: "de-DE",
      onError: () => {},
      children: createElement(DataProvider, { access, reasonTexts }, createElement(WeekShell)),
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
    calls,
    address,
    data,
    showProjects: (show: boolean) => showProjects(show),
    search: () => search,
  };
}

/**
 * Waits until the page shows what the check expects. The drawer's code loads on demand and the
 * Shell reveals it no sooner than 300 ms, so the default second of `vi.waitFor` can pass first.
 */
function shown<Value>(check: () => Value | Promise<Value>): Promise<Value> {
  return vi.waitFor(check, { timeout: 4_000 });
}

function drawer() {
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog === null) throw new Error("Edit Drawer is closed");
  return dialog;
}

function button(within: Element, label: string) {
  const found = [...within.querySelectorAll("button")].find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label,
  );
  if (found === undefined) throw new Error(`Missing ${label} button`);
  return found;
}

/** The section of one day, by its date read out in full. */
function day(name: string) {
  const found = document.querySelector(`section[aria-label="${name}"]`);
  if (found === null) throw new Error(`Missing day ${name}`);
  return found;
}

/** The rows of a day, each as its text. */
const rowsOf = (name: string) =>
  [...day(name).querySelectorAll("li")].map((row) => row.textContent ?? "");

const setValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  // React reads the value through the input's own setter, as typing sets it.
  const prototype = Object.getPrototypeOf(input) as object;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

/** The hours and minutes of the start and of the end, in the drawer's order. */
function times() {
  const [startHours, startMinutes, endHours, endMinutes] = [
    ...drawer().querySelectorAll<HTMLInputElement>('input[role="spinbutton"]'),
  ];
  if (endMinutes === undefined) throw new Error("Missing time inputs");
  return { startHours: startHours!, startMinutes: startMinutes!, endHours: endHours!, endMinutes };
}

/** Types `HH:MM` into a time's hours and minutes. */
async function typeTime(hours: HTMLInputElement, minutes: HTMLInputElement, time: string) {
  const [hh, mm] = time.split(":");
  setValue(hours, hh!);
  setValue(minutes, mm!);
  // The picker reports a part it holds after the input has been drawn.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const note = () => drawer().querySelector<HTMLTextAreaElement>("textarea")!;

test("an entry created on a clicked day of the week is sent with that day and appears there", async () => {
  const week = await renderWeek();
  const wednesday = await shown(() => day("Mittwoch, 18. November 2026"));
  button(wednesday, "New time entry on Mittwoch, 18. November 2026").click();

  await shown(() => expect(drawer().querySelector("input")).not.toBeNull());
  expect(drawer().querySelector<HTMLInputElement>("input")?.value).toBe("18.11.2026");
  const { startHours, startMinutes, endHours, endMinutes } = times();
  await typeTime(startHours, startMinutes, "09:00");
  await typeTime(endHours, endMinutes, "10:30");
  setValue(note(), "Review");
  await shown(() => expect(drawer().textContent).toContain("Duration: 1:30"));
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([
    {
      entry: "create",
      input: {
        timeKind: "work",
        startedAt: "2026-11-18T08:00:00.000Z",
        endedAt: "2026-11-18T09:30:00.000Z",
        projects: [],
        note: "Review",
        ruleByHand: null,
        breaks: [],
      },
    },
  ]);
  await shown(() =>
    expect(rowsOf("Mittwoch, 18. November 2026")).toEqual(["09:00 – 10:30No projectReview1:30"]),
  );
});

/** The primary action of the Shell: "New time entry" beside the View. */
function primaryAction() {
  const found = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "New time entry" && item.closest('[role="dialog"]') === null,
  );
  if (found === undefined) throw new Error("Missing the primary action");
  return found;
}

test("the primary action opens a new entry on today, and the entry appears in the week", async () => {
  const week = await renderWeek();
  await shown(() => day("Freitag, 20. November 2026"));
  primaryAction().click();

  await shown(() => expect(drawer().querySelector("input")?.value).toBe("20.11.2026"));
  const { startHours, startMinutes, endHours, endMinutes } = times();
  await typeTime(startHours, startMinutes, "13:00");
  await typeTime(endHours, endMinutes, "14:00");
  button(drawer(), "Save").click();

  await shown(() =>
    expect(rowsOf("Freitag, 20. November 2026")).toEqual(["13:00 – 14:00No project1:00"]),
  );
  expect(week.calls).toEqual([
    {
      entry: "create",
      input: {
        timeKind: "work",
        startedAt: "2026-11-20T12:00:00.000Z",
        endedAt: "2026-11-20T13:00:00.000Z",
        projects: [],
        note: null,
        ruleByHand: null,
        breaks: [],
      },
    },
  ]);
});

/** Wednesday 09:00:50 to 10:30:10 in Berlin, as a timer leaves it: both carry seconds. */
const TIMED = { startedAt: "2026-11-18T08:00:50.000Z", endedAt: "2026-11-18T09:30:10.000Z" };

/** The week with one stored entry, opened in the Edit Drawer from its row. */
async function openStored(
  fields: Record<string, unknown> = {},
  more?: (client: Client) => Promise<void>,
) {
  let id = "";
  const week = await renderWeek(async (client) => {
    const created = await client.timeTracking.create({
      ...TIMED,
      note: "Review",
      ...fields,
    } as never);
    id = created.id;
    await more?.(client);
  });
  const row = await shown(() => {
    const [first] = day("Mittwoch, 18. November 2026").querySelectorAll("li button");
    if (first === undefined) throw new Error("No row yet");
    return first as HTMLButtonElement;
  });
  row.click();
  await shown(() => expect(note().value).toBe(fields["note"] ?? "Review"));
  return { ...week, id };
}

test("a stored entry opens with its values, and saving a changed note sends only the note", async () => {
  const week = await openStored();
  expect(week.search()).toEqual({ edit: week.id });
  expect(drawer().querySelector("input")?.value).toBe("18.11.2026");
  expect(drawer().textContent).toContain("Duration: 1:29:20");

  setValue(note(), "Code review");
  await shown(() => expect(button(drawer(), "Save").disabled).toBe(false));
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([{ entry: "edit", input: { id: week.id, note: "Code review" } }]);
  await shown(() =>
    expect(rowsOf("Mittwoch, 18. November 2026")).toEqual([
      "09:00 – 10:30No projectCode review1:30",
    ]),
  );
});

test("saving another field of an entry with breaks leaves its breaks as they are", async () => {
  const breaks = [
    {
      timeKind: "rest_break",
      startedAt: "2026-11-18T08:30:00.000Z",
      endedAt: "2026-11-18T08:45:00.000Z",
      changedByLimit: false,
    },
  ];
  const week = await openStored({ breaks });
  setValue(note(), "Code review");
  await shown(() => expect(button(drawer(), "Save").disabled).toBe(false));
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([{ entry: "edit", input: { id: week.id, note: "Code review" } }]);
  await expect(week.client.timeTracking.entry({ id: week.id as never })).resolves.toMatchObject({
    note: "Code review",
    breaks,
    // 1:29:20 measured without the Rest Break of 0:15, rounded up to the minute.
    bookedDuration: 75 * 60,
  });
});

test("saving other fields of an entry that is not work leaves its Time Kind as it is", async () => {
  // The rounding resolution's Leisure Entry, 14:00:10 to 16:44:20 in Berlin.
  const week = await openStored({
    timeKind: "leisure",
    startedAt: "2026-11-18T13:00:10.000Z",
    endedAt: "2026-11-18T15:44:20.000Z",
  });
  setValue(note(), "Afternoon off");
  await shown(() => expect(button(drawer(), "Save").disabled).toBe(false));
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([{ entry: "edit", input: { id: week.id, note: "Afternoon off" } }]);
  await expect(week.client.timeTracking.entry({ id: week.id as never })).resolves.toMatchObject({
    timeKind: "leisure",
    note: "Afternoon off",
    bookedDuration: 0,
  });
});

test("the week shows a Break Entry and a Leisure Entry like any other, with its Rounded Time and its Booked Duration", async () => {
  await renderWeek(async (client) => {
    await client.timeTracking.create({
      ...TIMED,
      note: "Review",
    });
    await client.timeTracking.create({
      timeKind: "short_break",
      startedAt: "2026-11-18T09:30:00.000Z",
      endedAt: "2026-11-18T09:44:50.000Z",
      note: "Coffee",
    });
    await client.timeTracking.create({
      timeKind: "rest_break",
      startedAt: "2026-11-18T11:00:00.000Z",
      endedAt: "2026-11-18T11:30:00.000Z",
      note: "Lunch",
    });
    await client.timeTracking.create({
      timeKind: "leisure",
      startedAt: "2026-11-18T13:00:10.000Z",
      endedAt: "2026-11-18T15:44:20.000Z",
      note: "Afternoon off",
    });
  });
  await shown(() =>
    expect(rowsOf("Mittwoch, 18. November 2026")).toEqual([
      "09:00 – 10:30No projectReview1:30",
      "10:30 – 10:45No projectCoffee0:15",
      "12:00 – 12:30No projectLunch0:00",
      "14:00 – 16:45No projectAfternoon off0:00",
    ]),
  );
  // The day counts the work and the Short Break; the Rest Break and Leisure add nothing.
  expect(
    day("Mittwoch, 18. November 2026").querySelector('[aria-label="Day total"]')?.textContent,
  ).toBe("1:45");
});

test("the week shows an entry at its Rounded Time, and the drawer's fields hold its Measured Time", async () => {
  // The rounding resolution's timer, 10:07:30 to 10:29:50 in Berlin: it counts 10:07 to 10:30.
  await openStored({
    startedAt: "2026-11-18T09:07:30.000Z",
    endedAt: "2026-11-18T09:29:50.000Z",
    note: "Timer",
  });
  expect(rowsOf("Mittwoch, 18. November 2026")).toEqual(["10:07 – 10:30No projectTimer0:23"]);
  const { startHours, startMinutes, endHours, endMinutes } = times();
  expect([startHours.value, startMinutes.value, endHours.value, endMinutes.value]).toEqual([
    "10",
    "07",
    "10",
    "29",
  ]);
  expect(drawer().textContent).toContain("Duration: 0:22:20");
});

test("a changed start sends start and end, and the untouched end keeps its seconds", async () => {
  const week = await openStored();
  const { startHours, startMinutes } = times();
  await typeTime(startHours, startMinutes, "08:15");
  await shown(() => expect(drawer().textContent).toContain("Duration: 2:15:10"));
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([
    {
      entry: "edit",
      input: {
        id: week.id,
        startedAt: "2026-11-18T07:15:00.000Z",
        endedAt: "2026-11-18T09:30:10.000Z",
      },
    },
  ]);
});

test("delete closes the drawer with a Notice whose Undo brings the entry back", async () => {
  const week = await openStored();
  button(drawer(), "Delete").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await shown(() => expect(rowsOf("Mittwoch, 18. November 2026")).toEqual([]));
  const notice = await shown(() => {
    const found = [...document.querySelectorAll(".mantine-Notification-root")].find((item) =>
      item.textContent?.includes("Time entry deleted"),
    );
    expect(found).toBeDefined();
    return found!;
  });
  button(notice, "Undo").click();

  await shown(() =>
    expect(rowsOf("Mittwoch, 18. November 2026")).toEqual(["09:00 – 10:30No projectReview1:30"]),
  );
  expect(week.calls).toEqual([
    { entry: "delete", input: { id: week.id } },
    { entry: "restore", input: { id: week.id } },
  ]);
});

test("live Time Entries block project deletion and leave Archive available until the entries are deleted", async () => {
  const week = await renderWeek();
  const project = await week.client.projects.create({ title: "Website" });
  for (const note of ["Review", "Implementation"]) {
    await week.client.timeTracking.create({
      ...TIMED,
      projects: [{ projectId: project.id }],
      note,
    });
  }
  const wednesday = "Mittwoch, 18. November 2026";
  await shown(() => expect(rowsOf(wednesday)).toHaveLength(2));

  const openProject = () => {
    week.showProjects(true);
    week.address.writeSearch(() => ({ edit: project.id }));
  };
  const closed = () => shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

  openProject();
  await shown(() => {
    expect(drawer().querySelector("input")?.value).toBe("Website");
    const remove = button(drawer(), "Delete");
    expect(remove.disabled).toBe(true);
    const description = document.getElementById(remove.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Cannot be deleted: 2 time entries refer to it.");
    expect(button(drawer(), "Archive").disabled).toBe(false);
  });
  await expect(week.client.projects.delete({ id: project.id })).rejects.toMatchObject({
    code: "REFUSED",
  });
  button(drawer(), "Cancel").click();
  await closed();

  week.showProjects(false);
  for (const remaining of [2, 1]) {
    const row = await shown(() => {
      const rows = day(wednesday).querySelectorAll<HTMLButtonElement>("li button");
      expect(rows).toHaveLength(remaining);
      return rows[0]!;
    });
    row.click();
    const remove = await shown(() => button(drawer(), "Delete"));
    remove.click();
    await closed();
  }
  await shown(() => expect(rowsOf(wednesday)).toEqual([]));

  openProject();
  const remove = await shown(() => {
    expect(drawer().querySelector("input")?.value).toBe("Website");
    const remove = button(drawer(), "Delete");
    expect(remove.disabled).toBe(false);
    return remove;
  });
  remove.click();
  await closed();
  await expect(week.client.projects.active({})).resolves.toEqual([]);
});

test("an undo refused because the project was deleted meanwhile names the project", async () => {
  let projectId = "";
  const week = await openStored({}, async () => {});
  // A second entry of a project that is deleted once this entry is gone.
  const project = await week.client.projects.create({ title: "Website" });
  projectId = project.id;
  await week.client.timeTracking.edit({
    id: week.id as never,
    projects: [{ projectId: projectId as never }],
  });
  // The picker's value, not the drawer's text: the picker's list names the project before the
  // entry does, and the Notice takes the entry's name as it stands at the click.
  await shown(() =>
    expect([...drawer().querySelectorAll("input")].some((item) => item.value === "Website")).toBe(
      true,
    ),
  );
  button(drawer(), "Delete").click();
  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await week.client.projects.delete({ id: projectId as never });

  undoLatest();

  const refusal = await shown(() => {
    const found = document.querySelector('[role="alert"]');
    expect(found?.textContent).toContain("The linked project is no longer available.");
    return found!;
  });
  expect(refusal.textContent).toContain("Website");
  expect(rowsOf("Mittwoch, 18. November 2026")).toEqual([]);
});

/** Picks a project in the drawer's picker, as a click on its option does. */
async function pick(title: string) {
  const input = [...drawer().querySelectorAll<HTMLInputElement>("input")].find(
    (item) => item.closest(".mantine-Select-root") !== null,
  );
  if (input === undefined) throw new Error("Missing the project picker");
  input.click();
  const option = await shown(() => {
    // The picker's own list: the week's filter offers the projects too.
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

test("a save that points to a project deleted meanwhile shows the Refusal at the project field", async () => {
  let projectId = "";
  const week = await openStored({}, async (client) => {
    projectId = (await client.projects.create({ title: "Website" })).id;
  });
  await pick("Website");
  await week.client.projects.delete({ id: projectId as never });
  button(drawer(), "Save").click();

  await shown(() =>
    expect(drawer().textContent).toContain("The linked project is no longer available."),
  );
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(week.calls).toEqual([
    { entry: "edit", input: { id: week.id, projects: [{ projectId }] } },
  ]);
});

test("an entry of an archived project shows it and saves", async () => {
  let projectId = "";
  const week = await openStored({}, async (client) => {
    projectId = (await client.projects.create({ title: "Old site" })).id;
    await client.projects.archive({ id: projectId as never });
  });
  await week.client.timeTracking.edit({
    id: week.id as never,
    projects: [{ projectId: projectId as never }],
  });
  await shown(() =>
    expect(
      [...drawer().querySelectorAll("input")].some((item) => item.value === "Old site (archived)"),
    ).toBe(true),
  );
  setValue(note(), "Handover");
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([{ entry: "edit", input: { id: week.id, note: "Handover" } }]);
});

/** A stored entry with three projects, Website (Weight 2), Shop (1) and Blog (3), in its drawer. */
async function openWithThreeProjects() {
  const ids: Record<string, string> = {};
  const week = await openStored({}, async (client) => {
    for (const title of ["Website", "Shop", "Blog", "Other"])
      ids[title] = (await client.projects.create({ title })).id;
  });
  const projects = [
    { projectId: ids["Website"]!, weight: 2 },
    { projectId: ids["Shop"]!, weight: 1 },
    { projectId: ids["Blog"]!, weight: 3 },
  ];
  await week.client.timeTracking.edit({ id: week.id as never, projects: projects as never });
  await shown(() =>
    expect([...drawer().querySelectorAll("input")].some((item) => item.value === "Website")).toBe(
      true,
    ),
  );
  return { ...week, ids, projects };
}

test("saving another field of an entry with several projects sends no projects and keeps them", async () => {
  const week = await openWithThreeProjects();
  setValue(note(), "Code review");
  await shown(() => expect(button(drawer(), "Save").disabled).toBe(false));
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(week.calls).toEqual([{ entry: "edit", input: { id: week.id, note: "Code review" } }]);
  await expect(week.client.timeTracking.entry({ id: week.id as never })).resolves.toMatchObject({
    projects: week.projects,
  });
});

test("choosing a further project in the picker moves it to the front and keeps the others in order", async () => {
  const week = await openWithThreeProjects();
  await pick("Shop");
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  const [website, shop, blog] = week.projects;
  expect(week.calls).toEqual([
    { entry: "edit", input: { id: week.id, projects: [shop, website, blog] } },
  ]);
});

test("choosing another project in the picker replaces the Lead Project and keeps its Weight and the rest", async () => {
  const week = await openWithThreeProjects();
  await pick("Other");
  button(drawer(), "Save").click();

  await shown(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  const [, shop, blog] = week.projects;
  expect(week.calls).toEqual([
    {
      entry: "edit",
      input: { id: week.id, projects: [{ projectId: week.ids["Other"], weight: 2 }, shop, blog] },
    },
  ]);
});

const inputCommand = contribution.commands?.find((command) => command.kind === "input");

test("the input Command creates an entry without the form, and it appears in the week", async () => {
  const week = await renderWeek();
  await shown(() => day("Mittwoch, 18. November 2026"));
  if (inputCommand === undefined) throw new Error("No input Command");
  const result = await runCommand(
    inputCommand,
    { startedAt: "2026-11-18T08:00:00.000Z", endedAt: "2026-11-18T09:00:00.000Z", note: " Call " },
    { data: week.data },
  );
  expect(result).toMatchObject({ ok: true, value: { status: "success", data: { note: "Call" } } });
  await shown(() =>
    expect(rowsOf("Mittwoch, 18. November 2026")).toEqual(["09:00 – 10:00No projectCall1:00"]),
  );
});

test("the input Command holds the same checks: an end not after the start is an error at the end, and nothing is called", async () => {
  const week = await renderWeek();
  if (inputCommand === undefined) throw new Error("No input Command");
  const result = await runCommand(
    inputCommand,
    { startedAt: "2026-11-18T09:00:00.000Z", endedAt: "2026-11-18T09:00:00.900Z" },
    { data: week.data },
  );
  expect(result).toMatchObject({
    ok: false,
    error: { issues: [{ path: ["endedAt"], params: { reason: "end_before_start" } }] },
  });
  const unknown = await runCommand(
    inputCommand,
    { ...TIMED, bookedDuration: 60 },
    { data: week.data },
  );
  expect(unknown).toMatchObject({ ok: false, error: { issues: [{ code: "unrecognized_keys" }] } });
  expect(week.calls).toEqual([]);
});
