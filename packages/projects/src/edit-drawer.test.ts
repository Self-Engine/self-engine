// @vitest-environment happy-dom

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { createDataConnection } from "@self-engine/data-client";
import {
  DataProvider,
  portAccessOf,
  refusalTexts,
  useDataAccess,
} from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { defineReason } from "@self-engine/db/schema";
import { Shell, type ShellRouting, type ViewAddress, type ViewSearch } from "@self-engine/shell";
import { protectionRule } from "@self-engine/storage";
import { FeedbackHost } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { z } from "zod";
import { projectEntries } from "../test/project-entries-module/data/index.ts";
import { projectEntriesTableNames } from "../test/project-entries-module/table-names.ts";
import { projects } from "./data/index.ts";
import { projectsRowMap } from "./data/rows.ts";
import { contribution } from "./index.ts";

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  clearNotices();
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

function renderDrawer(id: string, realAccess: ReturnType<typeof portAccessOf>) {
  const access = {
    ...realAccess,
    call: vi.fn(realAccess.call.bind(realAccess)),
    clearance: vi.fn(realAccess.clearance.bind(realAccess)),
  };
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  const reasonTexts = refusalTexts([], (table) =>
    table === "project_entries" ? projectEntriesTableNames.project_entries : undefined,
  );
  let search: ViewSearch = { edit: id };
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
  function ProjectShell() {
    return createElement(Shell, {
      activeModule: contribution,
      activeView: contribution.views[0],
      contributions: [contribution],
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
  const container = document.createElement("div");
  document.body.append(container);
  cleanups.push(() => container.remove());
  const root = createRoot(container);
  cleanups.push(() => root.unmount());
  root.render(
    createElement(
      I18nProvider,
      { i18n },
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(FeedbackHost, {
          children: createElement(
            DataProvider,
            { access, reasonTexts },
            createElement(ProjectShell),
          ),
        }),
      ),
    ),
  );
  return { access, reopen: () => address.writeSearch(() => ({ edit: id })) };
}

function button(dialog: Element, label: string) {
  const found = [...dialog.querySelectorAll("button")].find((item) => item.textContent === label);
  if (found === undefined) throw new Error(`Missing ${label} button`);
  return found;
}

function drawer() {
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog === null) throw new Error("Edit Drawer is closed");
  return dialog;
}

test("a new reference refuses a delete from a stale drawer and blocks it on the next opening", async () => {
  const process = await startTestDataProcess({ modules: { projects, projectEntries } });
  cleanups.push(() => process.close());
  const client = createORPCClient<
    ContractRouterClient<{
      projects: typeof projects.contract;
      projectEntries: typeof projectEntries.contract;
    }>
  >(new RPCLink({ port: process.openPort() }));
  const project = await client.projects.create({ title: "Website" });
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());

  // Happy DOM lacks the browser's FontFaceSet. Mantine listens for font loads on it.
  Object.defineProperty(document, "fonts", { configurable: true, value: new EventTarget() });
  cleanups.push(() => {
    Reflect.deleteProperty(document, "fonts");
  });
  const { access, reopen } = renderDrawer(project.id, portAccessOf(connection));
  const remove = await vi.waitFor(() => {
    const remove = button(drawer(), "Delete");
    expect(remove.getAttribute("aria-disabled")).toBeNull();
    expect(remove.disabled).toBe(false);
    return remove;
  });
  const reference = await client.projectEntries.create({ projectId: project.id, label: "Work" });
  remove.click();

  const reason = "Cannot be deleted: 1 project entry refers to it.";
  await vi.waitFor(() => {
    const notice = document.querySelector('[role="alert"]');
    expect(notice?.textContent).toContain(reason);
    expect(notice?.textContent).toContain("Website");
    expect(notice?.textContent).toContain("Archive");
    expect(notice?.textContent).not.toContain("Undo");
  });
  await expect(client.projects.active({})).resolves.toEqual([project]);

  button(drawer(), "Cancel").click();
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  reopen();
  const blocked = await vi.waitFor(() => {
    const remove = button(drawer(), "Delete");
    expect(remove.disabled).toBe(true);
    expect(button(drawer(), "Archive").disabled).toBe(false);
    return remove;
  });
  const descriptionId = blocked.getAttribute("aria-describedby");
  expect(document.getElementById(descriptionId ?? "")?.textContent).toBe(reason);
  blocked.click();
  expect(access.call.mock.calls.filter(([, entry]) => entry === "delete")).toHaveLength(1);
  expect(access.clearance).toHaveBeenCalledTimes(2);

  await client.projectEntries.delete({ id: reference.id });
  expect(blocked.disabled).toBe(true);
  button(drawer(), "Cancel").click();
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  reopen();
  await vi.waitFor(() => {
    const remove = button(drawer(), "Delete");
    expect(remove.getAttribute("aria-disabled")).toBeNull();
    expect(remove.disabled).toBe(false);
  });
  expect(access.clearance).toHaveBeenCalledTimes(3);
});

/**
 * A rule from above that refuses every archive and every edit of a project once armed: armed
 * after the drawer's Clearance, it is what changed since the drawer opened.
 */
const kept = defineReason("kept", z.object({}));
let keeping = false;
const keepsProjects = (["archive", "update"] as const).map((write) =>
  protectionRule(projectsRowMap, {
    table: "projects",
    write,
    reasons: [kept],
    answer: async (_tx, _context, rows) =>
      keeping ? rows.map(({ id }) => ({ code: kept.code, row: id, details: {} })) : [],
  }),
);

/** The project "Website" in an open drawer, over a Data Process whose rules refuse it all. */
async function refusingDrawer() {
  const process = await startTestDataProcess({ modules: { projects }, rules: keepsProjects });
  cleanups.push(() => process.close());
  const client = createORPCClient<ContractRouterClient<{ projects: typeof projects.contract }>>(
    new RPCLink({ port: process.openPort() }),
  );
  const project = await client.projects.create({ title: "Website" });
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  Object.defineProperty(document, "fonts", { configurable: true, value: new EventTarget() });
  cleanups.push(() => {
    Reflect.deleteProperty(document, "fonts");
  });
  keeping = false;
  const { access } = renderDrawer(project.id, portAccessOf(connection));
  await vi.waitFor(() => expect(access.clearance).toHaveBeenCalled());
  const archive = await vi.waitFor(() => {
    const archive = button(drawer(), "Archive");
    expect(archive.getAttribute("aria-disabled")).toBeNull();
    return archive;
  });
  keeping = true;
  return archive;
}

/** The Notice of a Refusal on screen, once it names this text. */
const refusalNotice = (text: string) =>
  vi.waitFor(() => {
    const notice = document.querySelector('[role="alert"]');
    expect(notice?.textContent).toContain(text);
    return notice!;
  });

test("the Notice of a refused archive names the project", async () => {
  const archive = await refusingDrawer();
  archive.click();

  const notice = await refusalNotice("This change is not allowed.");
  expect(notice.textContent).toContain("Website");
  expect(notice.textContent).not.toContain("Undo");
});

test("the Notice of a refused save names the project the form edits", async () => {
  await refusingDrawer();
  const title = drawer().querySelector("input")!;
  // React reads the value through the input's own setter, as typing sets it.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Web");
  title.dispatchEvent(new Event("input", { bubbles: true }));
  await vi.waitFor(() => expect(button(drawer(), "Save").disabled).toBe(false));
  button(drawer(), "Save").click();

  const notice = await refusalNotice("This change is not allowed.");
  expect(notice.textContent).toContain("Website");
});
