// @vitest-environment happy-dom
// End to end without the app (#33): the module's own hooks and its Command's function form over
// the real client, building block and test Data Process with `placeholder-alpha` mounted. The list
// changes after each Operation through the Table Change of its commit alone, with no refetch by
// hand. No fake answers and no clock: each step waits for the render it expects.

import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import { Shell, type ShellRouting, type ShellContribution } from "@self-engine/shell";
import EditDrawer from "./edit-drawer.tsx";
import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { type DataAccess, DataProvider, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { placeholderAlpha } from "./data/index.ts";
import {
  ALL_ENTRIES,
  createEntry,
  createSampleEntry,
  useDeleteEntry,
  useEntries,
  useRenameEntry,
  useRestoreEntry,
} from "./port.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// The hooks render outside `act`: answers arrive over a real port, at no moment a test can name.
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

function useAlpha() {
  return {
    list: useEntries(ALL_ENTRIES),
    rename: useRenameEntry(),
    remove: useDeleteEntry(),
    restore: useRestoreEntry(),
  };
}

type Hooks = ReturnType<typeof useAlpha>;

async function renderOverPort(drawerId?: string, initialName?: string) {
  const process = await startTestDataProcess({ modules: { placeholderAlpha } });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);
  const real = portAccessOf(connection);
  const calls: { entry: string; input: unknown }[] = [];
  const access = {
    ...real,
    call: (module: string, entry: string, input: unknown, signal?: AbortSignal) => {
      calls.push({ entry, input });
      return real.call(module, entry, input, signal);
    },
  };

  let hooks: Hooks | undefined;
  const waiting = new Set<() => void>();
  function Probe(): ReactNode {
    hooks = useAlpha();
    for (const check of waiting) check();
    return null;
  }
  const notices: MessageDescriptor[] = [];
  // What a Command is given: the same access and notice seam as the provider (D261).
  const data: DataAccess = { access, notify: (notice) => notices.push(notice) };
  const container = document.createElement("div");
  document.body.append(container);
  cleanups.push(() => container.remove());
  const root = createRoot(container);
  cleanups.push(() => root.unmount());
  if (initialName !== undefined) {
    const result = await createEntry(data, { name: initialName });
    if (result.status !== "success") throw new Error("Seed failed");
    drawerId = result.data.id;
  }
  let done = 0;
  const module: ShellContribution = {
    id: "alpha",
    name: { id: "alpha", message: "Alpha" },
    icon: () => null,
    color: "blue",
    views: [
      {
        id: "overview",
        title: { id: "overview", message: "Overview" },
        load: async () => ({ default: () => null }),
      },
    ],
    editDrawer: async () => ({
      default: (props) =>
        createElement(EditDrawer, {
          ...props,
          onDone: () => {
            done++;
          },
        }),
    }),
  };
  const address = {
    search: () => ({ edit: drawerId }),
    subscribe: () => () => {},
    writeSearch: () => {},
    scopedWriteSearch: () => () => {},
  };
  const routing: ShellRouting = {
    useAddress: () => address,
    useGoToView: () => async () => true,
    useLeaveGuard: () => {},
    Link: ({ to, search: _search, ...props }) => createElement("a", { href: to, ...props }),
  };
  const content =
    drawerId === undefined
      ? createElement(Probe)
      : createElement(Shell, {
          activeModule: module,
          activeView: module.views[0],
          contributions: [module],
          settings: module,
          routing,
          data,
          onModuleSidebarCollapsedCommit: () => {},
          onModuleSidebarWidthCommit: () => {},
          onNavbarCommit: () => {},
          children: createElement(Probe),
        });
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  root.render(
    createElement(I18nProvider, {
      i18n,
      children: createElement(MantineProvider, {
        env: "test",
        children: createElement(DataProvider, { access, notify: data.notify }, content),
      }),
    }),
  );
  return {
    data,
    notices,
    container,
    done: () => done,
    calls,
    until(matches: (hooks: Hooks) => boolean): Promise<Hooks> {
      return new Promise((resolve) => {
        const check = () => {
          if (hooks === undefined || !matches(hooks)) return;
          waiting.delete(check);
          resolve(hooks);
        };
        waiting.add(check);
        check();
      });
    },
  };
}

const names = (hooks: Hooks) =>
  hooks.list.status === "content" ? hooks.list.data.map((entry) => entry.name) : undefined;

test("the list starts empty and follows every Operation without a refetch by hand", async () => {
  const rendered = await renderOverPort();
  const empty = await rendered.until((hooks) => hooks.list.status === "content");
  expect(names(empty)).toEqual([]);

  // The sample-entry Command's way in: the function form over the access it is given (D261).
  const studio = await createEntry(rendered.data, { name: "Studio work" });
  if (studio.status !== "success") throw new Error("Studio work was not created");
  await rendered.until((hooks) => names(hooks)?.length === 1);
  await createEntry(rendered.data, { name: "Garden work" });
  const both = await rendered.until((hooks) => names(hooks)?.length === 2);
  expect(names(both)).toEqual(["Studio work", "Garden work"]);

  expect(await createEntry(rendered.data, { name: "Garden work" })).toMatchObject({
    status: "conflict",
    field: "name",
  });
  expect(await both.rename.run({ id: studio.data.id, name: "Garden work" })).toMatchObject({
    status: "conflict",
    field: "name",
  });

  await both.rename.run({ id: studio.data.id, name: "Studio sketch" });
  const renamed = await rendered.until((hooks) => names(hooks)?.includes("Studio sketch") === true);

  await renamed.remove.run({ id: studio.data.id });
  const deleted = await rendered.until((hooks) => names(hooks)?.length === 1);
  expect(names(deleted)).toEqual(["Garden work"]);

  // Undo puts the entry back in its place.
  await deleted.restore.run({ id: studio.data.id });
  const restored = await rendered.until((hooks) => names(hooks)?.length === 2);
  expect(names(restored)).toEqual(["Studio sketch", "Garden work"]);
  expect(rendered.notices).toEqual([]);
});

test("undo meets a name taken meanwhile as a conflict with the module's text", async () => {
  const rendered = await renderOverPort();
  const ready = await rendered.until((hooks) => hooks.list.status === "content");
  const first = await createEntry(rendered.data, { name: "A" });
  if (first.status !== "success") throw new Error("A was not created");
  await ready.remove.run({ id: first.data.id });
  await createEntry(rendered.data, { name: "A" });
  const again = await rendered.until((hooks) => names(hooks)?.length === 1);

  const restored = await again.restore.run({ id: first.data.id });
  expect(restored).toMatchObject({ status: "conflict", reason: "name_taken", field: null });
  // No field can show it, so the building block shows the module's text as a notice (D264).
  expect(rendered.notices.map((notice) => notice.message)).toEqual([
    "The entry could not come back: another entry has its name now.",
  ]);
});

test("the sample-entry Command meets a taken name with a notice through the seam it is given", async () => {
  const rendered = await renderOverPort();
  await createSampleEntry(rendered.data, { name: "Sample entry" });

  expect(await createSampleEntry(rendered.data, { name: "Sample entry" })).toMatchObject({
    status: "conflict",
    field: null,
  });
  expect(rendered.notices.map((notice) => notice.message)).toEqual([
    "An entry with this name already exists.",
  ]);
});

async function nameField(rendered: Awaited<ReturnType<typeof renderOverPort>>) {
  return vi.waitFor(() => {
    const field = rendered.container.ownerDocument.querySelector("input");
    expect(field).not.toBeNull();
    return field!;
  });
}
function typeName(field: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
function saveButton() {
  return [...document.querySelectorAll("button")].find((button) => button.textContent === "Save")!;
}

test("an invalid name stays at the field without an Operation; the Data Process rejects the same input", async () => {
  const rendered = await renderOverPort("new");
  const field = await nameField(rendered);
  saveButton().click();
  await vi.waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(rendered.calls.filter((call) => call.entry !== "list")).toEqual([]);
  expect(rendered.notices).toEqual([]);
  expect(rendered.done()).toBe(0);
  const ready = await rendered.until((hooks) => hooks.list.status === "content");
  expect(names(ready)).toEqual([]);
  expect(await createEntry(rendered.data, { name: "" })).toMatchObject({ status: "unexpected" });
});

test("Enter creates an entry and a taken name remains at the field", async () => {
  const rendered = await renderOverPort("new");
  const field = await nameField(rendered);
  await createEntry(rendered.data, { name: "Taken" });
  typeName(field, "Taken");
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await vi.waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(document.body.textContent).toContain("An entry with this name already exists.");
  expect(rendered.done()).toBe(0);
  typeName(field, "Fresh");
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await vi.waitFor(() => expect(rendered.done()).toBe(1));
  const saved = await rendered.until((hooks) => names(hooks)?.includes("Fresh") === true);
  expect(names(saved)).toEqual(["Taken", "Fresh"]);
});

test("an edit enables Save only while its value differs and submits the changed name", async () => {
  const rendered = await renderOverPort("edit", "Original");
  const field = await nameField(rendered);
  expect(saveButton().disabled).toBe(true);
  typeName(field, "Original!");
  await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
  typeName(field, "Original");
  await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  typeName(field, "Renamed");
  saveButton().click();
  await vi.waitFor(() => expect(rendered.done()).toBe(1));
  await rendered.until((hooks) => names(hooks)?.includes("Renamed") === true);
  expect(rendered.calls.find((call) => call.entry === "rename")?.input).toMatchObject({
    name: "Renamed",
  });
});

test("deletion elsewhere preserves typed text with a warning and undo restores saving", async () => {
  const rendered = await renderOverPort("edit", "Original");
  const field = await nameField(rendered);
  typeName(field, "My draft");
  const ready = await rendered.until((hooks) => hooks.list.status === "content");
  if (ready.list.status !== "content") throw new Error("No list");
  const id = ready.list.data[0]!.id;
  await ready.remove.run({ id });
  await vi.waitFor(() => expect(document.body.textContent).toContain("This entry was deleted"));
  expect(field.value).toBe("My draft");
  expect(saveButton().disabled).toBe(true);
  await ready.restore.run({ id });
  await vi.waitFor(() => expect(document.body.textContent).not.toContain("This entry was deleted"));
  expect(field.value).toBe("My draft");
  expect(saveButton().disabled).toBe(false);
});

test("deletion inside the drawer keeps its contents without a warning through close", async () => {
  const rendered = await renderOverPort("edit", "Original");
  const field = await nameField(rendered);
  typeName(field, "My draft");
  const seen: string[] = [];
  const observer = new MutationObserver(() => seen.push(document.body.textContent ?? ""));
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  try {
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Delete")!
      .click();
    await rendered.until((hooks) => names(hooks)?.length === 0);
    expect(rendered.done()).toBe(1);
    expect(field.value).toBe("My draft");
    expect(seen.join(" ")).not.toContain("This entry was deleted");
    expect(document.body.textContent).not.toContain("Entry not found");
  } finally {
    observer.disconnect();
  }
});
