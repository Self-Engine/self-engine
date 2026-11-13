// @vitest-environment happy-dom
// The Notice that a shown answer may be outdated (D257): the building block shows it once per
// failed reload, however many hooks show that answer, and never for a failed first load, which
// the View shows as its error state. The notices are collected through the provider's `notify`.

import type { notesContract } from "@self-engine/storage/testing";
import type { QueryDisplayState } from "@self-engine/ui";
import { act } from "react";
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import {
  type FakePort,
  fakePort,
  renderHook,
  settle,
  type ShownNotices,
  unmountHook,
} from "./hook-harness.ts";
import { portHooks, type QueryState } from "./index.ts";
import { RELOAD_FAILED_NOTICE } from "./reload-notice.ts";

const useNoteList = portHooks<typeof notesContract>("notes").query("list");

type ListState = QueryState<readonly unknown[]>;

function fails(): never {
  throw new Error("The Data Process could not answer");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  unmountHook();
  vi.useRealTimers();
});

/** Shows two hooks on the same Query, as two Views of one list would, and collects the notices. */
async function showTwice(port: FakePort) {
  const notices: ShownNotices = [];
  const shown = await renderHook(port, (): ListState[] => [useNoteList({}), useNoteList({})], {
    notify: (notice) => notices.push(notice),
  });
  return { states: () => shown.current(), notices };
}

async function changeNotes(port: FakePort): Promise<void> {
  act(() => port.changeTables(["notes"]));
  await settle();
}

test("a failed reload keeps the answer and shows the Notice once, for two hooks", async () => {
  const port = fakePort();
  port.answer("list", () => [{ id: "note-0" }]);
  const { states, notices } = await showTwice(port);
  expect(states().map((state) => state.status)).toEqual(["content", "content"]);

  port.answer("list", fails);
  await changeNotes(port);

  expect(states().map((state) => state.status)).toEqual(["reloadFailed", "reloadFailed"]);
  expect(states()[0]).toMatchObject({ data: [{ id: "note-0" }] });
  expect(notices).toEqual([RELOAD_FAILED_NOTICE]);
});

test("each further failed reload shows the Notice again, a successful one does not", async () => {
  const port = fakePort();
  port.answer("list", () => [{ id: "note-0" }]);
  const { states, notices } = await showTwice(port);
  port.answer("list", fails);
  await changeNotes(port);
  await changeNotes(port);
  expect(notices).toEqual([RELOAD_FAILED_NOTICE, RELOAD_FAILED_NOTICE]);

  port.answer("list", () => [{ id: "note-1" }]);
  await changeNotes(port);
  expect(notices).toHaveLength(2);
  expect(states()[0]?.status).toBe("content");
});

test("a failed first load shows no Notice: the View shows its error state", async () => {
  const port = fakePort();
  port.answer("list", fails);
  const { states, notices } = await showTwice(port);
  expect(states()[0]?.status).toBe("loadFailed");
  expect(notices).toEqual([]);
});

test("a Query hook's state is what the state block in `ui` shows, as it is", () => {
  expectTypeOf<ListState>().toExtend<QueryDisplayState<readonly unknown[]>>();
});
