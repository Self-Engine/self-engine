// @vitest-environment happy-dom
// The Query hook (D249, D250) at its seam: hooks built for the `notes` test module, rendered
// against a substituted Port access whose Table Changes and reconnects the test drives by hand.
// Fake timers stand in for the clock: the query library batches its updates on `setTimeout(0)`.

import type { QueryTables, TablesChanged } from "@self-engine/contracts";
import type { notesContract } from "@self-engine/storage/testing";
import { createElement, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { DataProvider, type PortAccess, portHooks, type QueryState } from "./index.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const notesPort = portHooks<typeof notesContract>("notes");
const useNoteList = notesPort.query("list");
const useNote = notesPort.query("get");

const QUERIES: QueryTables = { notes: { list: ["notes"], get: ["notes"], window: ["notes"] } };

interface Call {
  readonly module: string;
  readonly entry: string;
  readonly input: unknown;
}

interface FakePort {
  readonly access: PortAccess;
  readonly calls: Call[];
  /** What each entry answers; called once per call, so every answer is a new object. */
  answer(entry: string, run: (input: unknown) => unknown): void;
  /** Delivers a Table Change, as the Data Process does after a commit. */
  changeTables(tables: TablesChanged): void;
  /** Reports a reconnect to the Data Process. */
  reconnect(): void;
}

function fakePort(queries: QueryTables = QUERIES): FakePort {
  const calls: Call[] = [];
  const answers = new Map<string, (input: unknown) => unknown>();
  const tablesListeners = new Set<(tables: TablesChanged) => void>();
  const reconnectListeners = new Set<() => void>();
  return {
    calls,
    access: {
      call(module, entry, input) {
        calls.push({ module, entry, input });
        const run = answers.get(`${module}.${entry}`);
        if (run === undefined) return Promise.reject(new Error(`No answer for ${entry}`));
        try {
          return Promise.resolve(run(input));
        } catch (error) {
          return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      describeEntry(module, entry) {
        const reads = queries[module]?.[entry];
        return reads === undefined ? { kind: "operation" } : { kind: "query", reads };
      },
      onTablesChanged(listener) {
        tablesListeners.add(listener);
        return () => tablesListeners.delete(listener);
      },
      onReconnected(listener) {
        reconnectListeners.add(listener);
        return () => reconnectListeners.delete(listener);
      },
    },
    answer(entry, run) {
      answers.set(`notes.${entry}`, run);
    },
    changeTables(tables) {
      for (const listener of tablesListeners) listener(tables);
    },
    reconnect() {
      for (const listener of reconnectListeners) listener();
    },
  };
}

const T0 = "2026-11-13T09:00:00.000Z";

function note(id: string, title: string) {
  return { id, createdAt: T0, updatedAt: T0, title, isPinned: false };
}

/** A fresh answer per call, so identity across reloads is the hook's doing. */
function listAnswer(titles: () => readonly string[]) {
  return () => titles().map((title, index) => note(`note-${index}`, title));
}

let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
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

interface Rendered<State> {
  /** The state of the last render. */
  current(): State;
  /** Shows or hides the hook, as a View that is shown or left. */
  show(visible: boolean): Promise<void>;
}

async function renderHook<State>(
  port: FakePort,
  useHook: () => State,
  options: { readonly reportMisuse?: (problem: string) => void } = {},
): Promise<Rendered<State>> {
  let state: State | undefined;
  function Probe(): ReactNode {
    state = useHook();
    return null;
  }
  container = document.createElement("div");
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  const draw = (visible: boolean) =>
    createElement(
      DataProvider,
      { access: port.access, ...options },
      visible ? createElement(Probe) : null,
    );
  act(() => mounted.render(draw(true)));
  await settle();
  return {
    current() {
      if (state === undefined) throw new Error("The hook has not rendered");
      return state;
    },
    async show(visible) {
      act(() => mounted.render(draw(visible)));
      await settle();
    },
  };
}

function data<Output>(state: QueryState<Output>): Output {
  if (!("data" in state)) throw new Error(`No answer, the state is ${state.status}`);
  return state.data;
}

const listCalls = (port: FakePort) => port.calls.filter((call) => call.entry === "list").length;

test("a Query hook reloads after a Table Change that names its table, not after another", async () => {
  const port = fakePort();
  let titles = ["Alpha"];
  port.answer(
    "list",
    listAnswer(() => titles),
  );
  const list = await renderHook(port, () => useNoteList({}));
  expect(list.current()).toMatchObject({ status: "content" });
  expect(data(list.current()).map((row) => row.title)).toEqual(["Alpha"]);
  expect(port.calls).toEqual([{ module: "notes", entry: "list", input: {} }]);

  titles = ["Beta"];
  port.changeTables(["links"]);
  await settle();
  expect(listCalls(port)).toBe(1);

  port.changeTables(["notes"]);
  await settle();
  expect(listCalls(port)).toBe(2);
  expect(data(list.current()).map((row) => row.title)).toEqual(["Beta"]);
});

test("a Query off screen is marked by a Table Change and called again only when shown", async () => {
  const port = fakePort();
  let titles = ["Alpha"];
  port.answer(
    "list",
    listAnswer(() => titles),
  );
  const list = await renderHook(port, () => useNoteList({}));
  await list.show(false);

  titles = ["Beta"];
  port.changeTables(["notes"]);
  await settle();
  expect(listCalls(port)).toBe(1);

  await list.show(true);
  expect(listCalls(port)).toBe(2);
  expect(data(list.current()).map((row) => row.title)).toEqual(["Beta"]);
});

test("a Query shown again without a Table Change in between is not called again", async () => {
  const port = fakePort();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const list = await renderHook(port, () => useNoteList({}));
  await list.show(false);
  await list.show(true);

  expect(listCalls(port)).toBe(1);
  expect(list.current()).toMatchObject({ status: "content" });
});

/** An answer the test lets arrive when it wants. */
function held<Value>() {
  let resolve: (value: Value) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<Value>((settleWith, failWith) => {
    resolve = settleWith;
    reject = failWith;
  });
  return { promise, resolve, reject };
}

test("a Query on screen keeps its previous answer until the reload arrives", async () => {
  const port = fakePort();
  const first = listAnswer(() => ["Alpha"]);
  const reload = held<ReturnType<typeof first>>();
  port.answer("list", first);
  const list = await renderHook(port, () => useNoteList({}));

  port.answer("list", () => reload.promise);
  port.changeTables(["notes"]);
  await settle();
  expect(list.current()).toMatchObject({ status: "reloading" });
  expect(data(list.current()).map((row) => row.title)).toEqual(["Alpha"]);

  reload.resolve([note("note-0", "Beta")]);
  await settle();
  expect(list.current()).toMatchObject({ status: "content" });
  expect(data(list.current()).map((row) => row.title)).toEqual(["Beta"]);
});

test("a Query shown again after a Table Change shows its previous answer while it reloads", async () => {
  const port = fakePort();
  const reload = held<ReturnType<ReturnType<typeof listAnswer>>>();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const list = await renderHook(port, () => useNoteList({}));
  await list.show(false);
  port.changeTables(["notes"]);
  port.answer("list", () => reload.promise);

  await list.show(true);
  expect(list.current()).toMatchObject({ status: "reloading" });
  expect(data(list.current()).map((row) => row.title)).toEqual(["Alpha"]);
});

test("a reconnect marks every answer, and the Queries on screen reload", async () => {
  const port = fakePort();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  port.answer("get", (input) => note((input as { id: string }).id, "Alpha"));
  const list = await renderHook(port, () => ({
    list: useNoteList({}),
    // A Query whose tables no Table Change names: only the reconnect marks it.
    note: useNote({ id: "note-0" as never }),
  }));
  expect(port.calls).toHaveLength(2);

  port.reconnect();
  await settle();
  expect(port.calls.map((call) => call.entry).toSorted()).toEqual(["get", "get", "list", "list"]);
  expect(list.current().list).toMatchObject({ status: "content" });
});

test("a reconnect marks an answer off screen, which reloads when shown", async () => {
  const port = fakePort({ notes: { list: [] } });
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const list = await renderHook(port, () => useNoteList({}));
  await list.show(false);

  port.reconnect();
  await settle();
  expect(listCalls(port)).toBe(1);

  await list.show(true);
  expect(listCalls(port)).toBe(2);
});

test("window focus causes no call", async () => {
  const port = fakePort();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  await renderHook(port, () => useNoteList({}));

  act(() => {
    // The events a browser sends when the window comes back, and when the network does.
    window.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  await settle();

  expect(listCalls(port)).toBe(1);
});

test("after a reload, rows that did not change are the same objects as before", async () => {
  const port = fakePort();
  let titles = ["Alpha", "Beta", "Gamma"];
  port.answer(
    "list",
    listAnswer(() => titles),
  );
  const list = await renderHook(port, () => useNoteList({}));
  const before = data(list.current());

  titles = ["Alpha", "Renamed", "Gamma"];
  port.changeTables(["notes"]);
  await settle();
  const after = data(list.current());

  expect(after[0]).toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
  expect(after[1]?.title).toBe("Renamed");
  expect(after[2]).toBe(before[2]);
});

test("a failed first load offers a retry, which calls again", async () => {
  const port = fakePort();
  port.answer("list", () => {
    throw new Error("disk full");
  });
  const list = await renderHook(port, () => useNoteList({}));
  const failed = list.current();
  expect(failed).toMatchObject({ status: "loadFailed", error: new Error("disk full") });

  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  act(() => {
    if (failed.status === "loadFailed") failed.retry();
  });
  await settle();
  expect(listCalls(port)).toBe(2);
  expect(list.current()).toMatchObject({ status: "content" });
});

test("a failed reload keeps the previous answer", async () => {
  const port = fakePort();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const list = await renderHook(port, () => useNoteList({}));

  port.answer("list", () => {
    throw new Error("disk full");
  });
  port.changeTables(["notes"]);
  await settle();

  expect(list.current()).toMatchObject({ status: "reloadFailed", error: new Error("disk full") });
  expect(data(list.current()).map((row) => row.title)).toEqual(["Alpha"]);
});

test("an answer no View shows is dropped after 5 minutes, not before", async () => {
  const port = fakePort();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const list = await renderHook(port, () => useNoteList({}));
  await list.show(false);

  await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1));
  await list.show(true);
  expect(listCalls(port)).toBe(1);
  expect(list.current()).toMatchObject({ status: "content" });

  await list.show(false);
  await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000));
  const shown = list.show(true);
  expect(list.current()).toMatchObject({ status: "loading" });
  await shown;
  expect(listCalls(port)).toBe(2);
});

test("a Query hook that points at an Operation is reported once", async () => {
  const port = fakePort();
  const create = notesPort.query("create");
  port.answer("create", () => note("note-0", "Alpha"));
  const problems: string[] = [];
  const reportMisuse = (problem: string) => problems.push(problem);
  const list = await renderHook(port, () => create({ title: "Alpha", isPinned: false }), {
    reportMisuse,
  });
  await list.show(false);
  await list.show(true);

  expect(problems).toEqual([
    "The Query hook for notes.create points at an Operation; use an Operation hook.",
  ]);
});

test("a Query hook on a Query reports nothing", async () => {
  const port = fakePort();
  port.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const problems: string[] = [];
  await renderHook(port, () => useNoteList({}), { reportMisuse: (p) => problems.push(p) });

  expect(problems).toEqual([]);
});

test("hook input and answer are typed from the module's Contract", () => {
  // Compile-time checks: the type check of `pnpm verify` fails if any expectation breaks.
  const typed = () => {
    const state = useNote({ id: "note-0" as never });
    if (state.status === "content") {
      const title: string = state.data.title;
      // @ts-expect-error The Contract's note has no `name`.
      void state.data.name;
      void title;
    }
    // @ts-expect-error `get` needs an `id`.
    useNote({});
    // @ts-expect-error `create` needs a non-empty title and isPinned, not a number.
    notesPort.query("create")({ title: 1 });
  };
  // @ts-expect-error A misspelled entry is not in the Contract.
  notesPort.query("lsit");
  expect(typeof typed).toBe("function");
});
