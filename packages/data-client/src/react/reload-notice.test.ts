// @vitest-environment happy-dom
// The Notice that a shown answer may be outdated (D257): the building block shows it once per
// failed reload, however many hooks show that answer, and never for a failed first load, which
// the View shows as its error state. The feedback system is replaced, so no Notice is drawn.

import type { TablesChanged } from "@self-engine/contracts";
import type { notesContract } from "@self-engine/storage/testing";
import { notifyError, type QueryDisplayState } from "@self-engine/ui";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { DataProvider, type PortAccess, portHooks, type QueryState } from "./index.ts";

vi.mock("@self-engine/ui", () => ({ notifyError: vi.fn() }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const useNoteList = portHooks<typeof notesContract>("notes").query("list");

type ListState = QueryState<readonly unknown[]>;

/** A Port access whose `notes.list` answers or fails as the test says, and whose Table Changes
 * the test delivers. */
function fakePort() {
  let answer: () => unknown = () => [];
  const listeners = new Set<(tables: TablesChanged) => void>();
  const access: PortAccess = {
    call: () => {
      try {
        return Promise.resolve(answer());
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
    describeEntry: () => ({ kind: "query", reads: ["notes"] }),
    onTablesChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onReconnected: () => () => undefined,
  };
  return {
    access,
    answers(run: () => unknown) {
      answer = run;
    },
    changeTables(tables: TablesChanged) {
      for (const listener of listeners) listener(tables);
    },
  };
}

function fails(): never {
  throw new Error("The Data Process could not answer");
}

let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(notifyError).mockClear();
});

afterEach(() => {
  if (root !== undefined) act(() => root?.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
  vi.useRealTimers();
});

/** Lets answers arrive and the library's batched updates reach React. */
async function settle(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

/** Shows `count` hooks on the same Query, as two Views of one list would, and their states. */
async function show(access: PortAccess, count: number): Promise<ListState[]> {
  const states: ListState[] = [];
  function Probe({ index }: { readonly index: number }): ReactNode {
    states[index] = useNoteList({});
    return null;
  }
  container = document.createElement("div");
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  const probes = Array.from({ length: count }, (_, index) =>
    createElement(Probe, { key: index, index }),
  );
  act(() => mounted.render(createElement(DataProvider, { access }, ...probes)));
  await settle();
  return states;
}

test("a failed reload keeps the answer and shows the Notice once, for two hooks", async () => {
  const port = fakePort();
  port.answers(() => [{ id: "note-0" }]);
  const states = await show(port.access, 2);
  expect(states.map((state) => state.status)).toEqual(["content", "content"]);

  port.answers(fails);
  act(() => port.changeTables(["notes"]));
  await settle();

  expect(states.map((state) => state.status)).toEqual(["reloadFailed", "reloadFailed"]);
  expect(states[0]).toMatchObject({ data: [{ id: "note-0" }] });
  expect(notifyError).toHaveBeenCalledOnce();
});

test("each further failed reload shows the Notice again, a successful one does not", async () => {
  const port = fakePort();
  port.answers(() => [{ id: "note-0" }]);
  const states = await show(port.access, 1);
  port.answers(fails);
  act(() => port.changeTables(["notes"]));
  await settle();
  act(() => port.changeTables(["notes"]));
  await settle();
  expect(notifyError).toHaveBeenCalledTimes(2);

  port.answers(() => [{ id: "note-1" }]);
  act(() => port.changeTables(["notes"]));
  await settle();
  expect(notifyError).toHaveBeenCalledTimes(2);
  expect(states[0]?.status).toBe("content");
});

test("a failed first load shows no Notice: the View shows its error state", async () => {
  const port = fakePort();
  port.answers(fails);
  const [state] = await show(port.access, 1);
  expect(state?.status).toBe("loadFailed");
  expect(notifyError).not.toHaveBeenCalled();
});

test("a Query hook's state is what the state block in `ui` shows, as it is", () => {
  expectTypeOf<ListState>().toExtend<QueryDisplayState<readonly unknown[]>>();
});
