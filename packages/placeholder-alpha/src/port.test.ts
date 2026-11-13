// @vitest-environment happy-dom
// End to end without the app (#33): the module's own hooks and its Command's function form over
// the real client, building block and test Data Process with `placeholder-alpha` mounted. The list
// changes after each Operation through the Table Change of its commit alone, with no refetch by
// hand. No fake answers and no clock: each step waits for the render it expects.

import type { MessageDescriptor } from "@lingui/core";
import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { DataProvider, type PortAccess, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { placeholderAlpha } from "./data/index.ts";
import {
  ALL_ENTRIES,
  createEntry,
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

async function renderOverPort() {
  const process = await startTestDataProcess({ modules: { placeholderAlpha } });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);
  const access: PortAccess = portAccessOf(connection);

  let hooks: Hooks | undefined;
  const waiting = new Set<() => void>();
  function Probe(): ReactNode {
    hooks = useAlpha();
    for (const check of waiting) check();
    return null;
  }
  const notices: MessageDescriptor[] = [];
  const root = createRoot(document.createElement("div"));
  cleanups.push(() => root.unmount());
  root.render(
    createElement(
      DataProvider,
      { access, notify: (notice) => notices.push(notice) },
      createElement(Probe),
    ),
  );
  return {
    access,
    notices,
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
  const studio = await createEntry(rendered.access, { name: "Studio work" });
  if (studio.status !== "success") throw new Error("Studio work was not created");
  await rendered.until((hooks) => names(hooks)?.length === 1);
  await createEntry(rendered.access, { name: "Garden work" });
  const both = await rendered.until((hooks) => names(hooks)?.length === 2);
  expect(names(both)).toEqual(["Studio work", "Garden work"]);

  expect(await createEntry(rendered.access, { name: "Garden work" })).toMatchObject({
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
  const first = await createEntry(rendered.access, { name: "A" });
  if (first.status !== "success") throw new Error("A was not created");
  await ready.remove.run({ id: first.data.id });
  await createEntry(rendered.access, { name: "A" });
  const again = await rendered.until((hooks) => names(hooks)?.length === 1);

  const restored = await again.restore.run({ id: first.data.id });
  expect(restored).toMatchObject({ status: "conflict", reason: "name_taken", field: "id" });
});
