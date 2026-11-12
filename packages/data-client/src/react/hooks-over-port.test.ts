// @vitest-environment happy-dom
// The hooks over the real connection (D251, D250): the `notes` test module in the test Data
// Process answers with its own conflicts and "not found", and its Table Changes alone reload the
// Query hooks. No fake answers and no clock: each step waits for the render it expects.

import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { notes, type notesContract } from "@self-engine/storage/testing";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { createDataConnection, type DataConnection } from "../index.ts";
import { DataProvider, portAccessOf, portHooks } from "./index.ts";
import { NOT_FOUND_NOTICE } from "./operation-hook.ts";

// The hooks render outside `act`: answers arrive over a real port, at no moment a test can name.
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const notesPort = portHooks<typeof notesContract>("notes");
const TITLE_TAKEN = msg`A note with this title already exists.`;
const useNoteList = notesPort.query("list");
const useCreateNote = notesPort.operation("create", {
  conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
});
const useRenameNote = notesPort.operation("update", {
  conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
});

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

function useNotes() {
  return { list: useNoteList({}), create: useCreateNote(), rename: useRenameNote() };
}

type Hooks = ReturnType<typeof useNotes>;

/** Renders the hooks over a fresh test Data Process; `until` waits for a render that matches. */
async function renderOverPort() {
  const process: TestDataProcess = await startTestDataProcess({ modules: { notes } });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);

  let hooks: Hooks | undefined;
  const waiting = new Set<() => void>();
  function Probe(): ReactNode {
    hooks = useNotes();
    for (const check of waiting) check();
    return null;
  }
  const notices: MessageDescriptor[] = [];
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  cleanups.push(() => root.unmount());
  root.render(
    createElement(
      DataProvider,
      { access: portAccessOf(connection), notify: (notice) => notices.push(notice) },
      createElement(Probe),
    ),
  );
  return {
    notices,
    current(): Hooks {
      if (hooks === undefined) throw new Error("The hooks have not rendered");
      return hooks;
    },
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

const titles = (hooks: Hooks) => (hooks.list.status === "content" ? hooks.list.data : []).map((note) => note.title);

test("each result of the notes module arrives as a value, and the list reloads on its Table Change alone", async () => {
  const rendered = await renderOverPort();
  await rendered.until((hooks) => hooks.list.status === "content");

  const created = await rendered.current().create.run({ title: "Alpha", isPinned: false });
  expect(created).toMatchObject({ status: "success", data: { title: "Alpha" } });
  await rendered.until((hooks) => titles(hooks).includes("Alpha"));
  await rendered.current().create.run({ title: "Beta", isPinned: false });
  const both = await rendered.until((hooks) => titles(hooks).length === 2);
  if (created.status !== "success") throw new Error("Alpha was not created");

  const taken = await both.rename.run({ id: created.data.id, title: "Beta" });
  expect(taken).toEqual({ status: "conflict", reason: "title_taken", field: "title", text: TITLE_TAKEN });

  // A well-formed id that names no note.
  const missing = "01900000-0000-7000-8000-000000000000" as typeof created.data.id;
  const gone = await both.rename.run({ id: missing, title: "Gamma" });
  expect(gone).toEqual({ status: "notFound" });

  const renamed = await both.rename.run({ id: created.data.id, title: "Gamma" });
  expect(renamed).toMatchObject({ status: "success", data: { title: "Gamma" } });
  // Nothing refetches by hand: the Table Change of the rename reloads the list.
  const after = await rendered.until((hooks) => titles(hooks).includes("Gamma"));
  expect(titles(after).toSorted()).toEqual(["Beta", "Gamma"]);
  expect(rendered.notices).toEqual([NOT_FOUND_NOTICE]);
});
