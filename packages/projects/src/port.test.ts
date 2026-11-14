// @vitest-environment happy-dom
// End to end without the app (#33): the module's hooks and its Commands over the real client,
// building block and test Data Process with `projects` mounted. The lists change after each
// Operation through the Table Change of its commit alone. No fake answers and no clock: each step
// waits for the render it expects. The form is proven in the stories, in a real browser: Mantine's
// growing text field needs one.

import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { type DataAccess, DataProvider, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { runCommand } from "@self-engine/shell";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { projects } from "./data/index.ts";
import { contribution } from "./index.ts";
import { ACTIVE_PROJECTS, createProject, useActiveProjects } from "./port.ts";

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

type List = ReturnType<typeof useActiveProjects>;

/** The test Data Process with `projects`, and two readers of "Active" for two open Views. */
async function renderOverPort() {
  const process = await startTestDataProcess({ modules: { projects } });
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

  const lists: [List | undefined, List | undefined] = [undefined, undefined];
  const waiting = new Set<() => void>();
  function Reader({ index }: { readonly index: 0 | 1 }): ReactNode {
    lists[index] = useActiveProjects(ACTIVE_PROJECTS);
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
  const readers = [
    createElement(Reader, { index: 0, key: 0 }),
    createElement(Reader, { index: 1, key: 1 }),
  ];
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  root.render(
    createElement(I18nProvider, {
      i18n,
      children: createElement(MantineProvider, {
        env: "test",
        children: createElement(DataProvider, { access, notify: data.notify }, readers),
      }),
    }),
  );
  return {
    process,
    data,
    notices,
    calls,
    /** Resolves once both readers show `matches`. */
    until(matches: (list: List) => boolean): Promise<List> {
      return new Promise((resolve) => {
        const check = () => {
          const [first, second] = lists;
          if (first === undefined || second === undefined) return;
          if (!matches(first) || !matches(second)) return;
          waiting.delete(check);
          resolve(first);
        };
        waiting.add(check);
        check();
      });
    },
  };
}

const titles = (list: List) =>
  list.status === "content" ? list.data.map((project) => project.title) : undefined;

test("a project created with only a title appears in every open View without a reload", async () => {
  const rendered = await renderOverPort();
  const empty = await rendered.until((list) => list.status === "content");
  expect(titles(empty)).toEqual([]);

  const created = await createProject(rendered.data, { title: "Website" });

  expect(created).toEqual({
    status: "success",
    data: {
      id: expect.any(String),
      title: "Website",
      description: null,
      icon: null,
      color: null,
      archivedAt: null,
    },
  });
  const both = await rendered.until((list) => titles(list)?.length === 1);
  expect(titles(both)).toEqual(["Website"]);
  expect(rendered.notices).toEqual([]);
});

test("create trims the title, stores an empty description as no value and keeps icon and color", async () => {
  const rendered = await renderOverPort();
  const created = await createProject(rendered.data, {
    title: "  Garden  ",
    description: "   ",
    icon: "🌱",
    color: "lime",
  });
  expect(created).toMatchObject({
    status: "success",
    data: { title: "Garden", description: null, icon: "🌱", color: "lime" },
  });
  const listed = await rendered.until((list) => titles(list)?.length === 1);
  expect(listed.status === "content" && listed.data[0]).toMatchObject({
    title: "Garden",
    description: null,
  });
});

test("two projects with the same title can both be created", async () => {
  const rendered = await renderOverPort();
  const first = await createProject(rendered.data, { title: "Tax" });
  const second = await createProject(rendered.data, { title: "Tax" });
  expect(first.status).toBe("success");
  expect(second.status).toBe("success");
  const both = await rendered.until((list) => titles(list)?.length === 2);
  expect(titles(both)).toEqual(["Tax", "Tax"]);
});

test("the Data Process rejects an unknown field, an empty title and an unknown icon", async () => {
  const rendered = await renderOverPort();
  for (const input of [
    { title: "Website", titel: "Website" },
    { title: "   " },
    { title: "x".repeat(201) },
    { title: "Website", icon: "no-such-icon" },
    { title: "Website", color: "gray" },
  ]) {
    // The Operation's types refuse these inputs; a caller without types can still send them.
    expect(await createProject(rendered.data, input as { title: string })).toMatchObject({
      status: "unexpected",
    });
  }
  const ready = await rendered.until((list) => list.status === "content");
  expect(titles(ready)).toEqual([]);
});

const inputCommand = contribution.commands?.find((command) => command.kind === "input");

test("the input Command creates a project and answers with it", async () => {
  const rendered = await renderOverPort();
  if (inputCommand === undefined) throw new Error("No input Command");
  const result = await runCommand(
    inputCommand,
    { title: " Website ", icon: "house" },
    { data: rendered.data },
  );
  expect(result).toMatchObject({
    ok: true,
    value: { status: "success", data: { title: "Website", icon: "house" } },
  });
  await rendered.until((list) => titles(list)?.length === 1);
});

test("the input Command answers an invalid input with the error and its field, and calls nothing", async () => {
  const rendered = await renderOverPort();
  if (inputCommand === undefined) throw new Error("No input Command");
  const empty = await runCommand(inputCommand, { title: "" }, { data: rendered.data });
  expect(empty).toMatchObject({ ok: false, error: { issues: [{ path: ["title"] }] } });
  const unknown = await runCommand(
    inputCommand,
    { title: "Website", titel: "Website" },
    { data: rendered.data },
  );
  expect(unknown).toMatchObject({
    ok: false,
    error: { issues: [{ code: "unrecognized_keys", keys: ["titel"] }] },
  });
  expect(rendered.calls.filter((call) => call.entry !== "active")).toEqual([]);
});

/** A call through the Port as the app makes it, answered with the data or the error's code. */
async function callPort(data: DataAccess, entry: string, input: unknown) {
  try {
    return { data: await data.access.call("projects", entry, input) };
  } catch (error) {
    return { error: (error as { code?: string }).code ?? "unexpected" };
  }
}

test("an edit of the title alone changes the title in every open View and keeps the rest", async () => {
  const rendered = await renderOverPort();
  const created = await createProject(rendered.data, {
    title: "Website",
    description: "Relaunch",
    icon: "house",
    color: "teal",
  });
  if (created.status !== "success") throw new Error("Not created");
  await rendered.until((list) => titles(list)?.length === 1);

  const edited = await callPort(rendered.data, "edit", { id: created.data.id, title: " Shop " });

  expect(edited).toEqual({ data: { ...created.data, title: "Shop" } });
  const both = await rendered.until((list) => titles(list)?.[0] === "Shop");
  expect(both.status === "content" && both.data).toEqual([{ ...created.data, title: "Shop" }]);
});

test("null clears the description, and an edit without fields answers with the project", async () => {
  const rendered = await renderOverPort();
  const created = await createProject(rendered.data, { title: "Website", description: "Old" });
  if (created.status !== "success") throw new Error("Not created");
  const { id } = created.data;

  expect(await callPort(rendered.data, "edit", { id, description: null })).toEqual({
    data: { ...created.data, description: null },
  });
  expect(await callPort(rendered.data, "edit", { id })).toEqual({
    data: { ...created.data, description: null },
  });
});

test("a project whose stored icon this version does not know keeps it when its title changes", async () => {
  const rendered = await renderOverPort();
  const process = rendered.process;
  const created = await createProject(rendered.data, { title: "Website", icon: "house" });
  if (created.status !== "success") throw new Error("Not created");
  // As a newer version of the app would have written it.
  await process.database.executeScript(
    `UPDATE projects SET icon = 'icon-of-a-newer-version' WHERE id = '${created.data.id}'`,
  );

  const edited = await callPort(rendered.data, "edit", { id: created.data.id, title: "Shop" });

  expect(edited).toMatchObject({ data: { title: "Shop", icon: "icon-of-a-newer-version" } });
});

test("an edit with an unknown field or an empty title is an input error and changes nothing", async () => {
  const rendered = await renderOverPort();
  const created = await createProject(rendered.data, { title: "Website" });
  if (created.status !== "success") throw new Error("Not created");
  const { id } = created.data;
  for (const input of [
    { id, titel: "Shop" },
    { id, title: "  " },
    { id, title: null },
  ]) {
    expect(await callPort(rendered.data, "edit", input)).toEqual({ error: "BAD_REQUEST" });
  }
  expect(await callPort(rendered.data, "edit", { id })).toEqual({ data: created.data });
});

test("a delete leaves every open View, and restore brings the project back as it was", async () => {
  const rendered = await renderOverPort();
  const created = await createProject(rendered.data, { title: "Website", icon: "house" });
  if (created.status !== "success") throw new Error("Not created");
  const { id } = created.data;
  await rendered.until((list) => titles(list)?.length === 1);

  expect(await callPort(rendered.data, "delete", { id })).toEqual({ data: created.data });
  await rendered.until((list) => titles(list)?.length === 0);
  expect(await callPort(rendered.data, "edit", { id, title: "Shop" })).toEqual({
    error: "NOT_FOUND",
  });
  expect(await callPort(rendered.data, "delete", { id })).toEqual({ error: "NOT_FOUND" });

  expect(await callPort(rendered.data, "restore", { id })).toEqual({ data: created.data });
  const back = await rendered.until((list) => titles(list)?.length === 1);
  expect(back.status === "content" && back.data).toEqual([created.data]);
  expect(await callPort(rendered.data, "restore", { id })).toEqual({ error: "NOT_FOUND" });
});

test("a project comes back even when another project carries its title by now", async () => {
  const rendered = await renderOverPort();
  const first = await createProject(rendered.data, { title: "Tax" });
  if (first.status !== "success") throw new Error("Not created");
  await callPort(rendered.data, "delete", { id: first.data.id });
  await createProject(rendered.data, { title: "Tax" });

  expect(await callPort(rendered.data, "restore", { id: first.data.id })).toEqual({
    data: first.data,
  });
  const both = await rendered.until((list) => titles(list)?.length === 2);
  expect(titles(both)).toEqual(["Tax", "Tax"]);
});
