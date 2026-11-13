// @vitest-environment happy-dom
// The Query hook (D249, D250) at its seam: hooks built for the `notes` test module, rendered
// against a substituted Port access whose Table Changes and reconnects the test drives by hand.
// Fake timers stand in for the clock: the query library batches its updates on `setTimeout(0)`.

import type { notesContract } from "@self-engine/storage/testing";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { type FakePort, fakePort, held, renderHook, settle, unmountHook } from "./hook-harness.ts";
import { portHooks, type QueryState } from "./index.ts";
import { useDataContext } from "./provider.ts";

const notesPort = portHooks<typeof notesContract>("notes");
const useNoteList = notesPort.query("list");
const useNote = notesPort.query("get");

const T0 = "2026-11-13T09:00:00.000Z";

function note(id: string, title: string) {
  return { id, createdAt: T0, updatedAt: T0, title, isPinned: false };
}

/** A fresh answer per call, so identity across reloads is the hook's doing. */
function listAnswer(titles: () => readonly string[]) {
  return () => titles().map((title, index) => note(`note-${index}`, title));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  unmountHook();
  vi.useRealTimers();
});

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

test.each([
  ["a Table Change that names its table", (port: FakePort) => port.changeTables(["notes"])],
  ["a reconnect", (port: FakePort) => port.reconnect()],
])(
  "%s during a Query's first load makes it read again once that load arrives",
  async (_, change) => {
    const port = fakePort();
    const first = held<ReturnType<ReturnType<typeof listAnswer>>>();
    port.answer("list", () => first.promise);
    const list = await renderHook(port, () => useNoteList({}));
    expect(list.current()).toMatchObject({ status: "loading" });

    // The write commits while the first read is under way; its answer may predate the write.
    change(port);
    change(port);
    await settle();
    port.answer(
      "list",
      listAnswer(() => ["Beta"]),
    );
    first.resolve([note("note-0", "Alpha")]);
    await settle();

    expect(listCalls(port)).toBe(2);
    expect(data(list.current()).map((row) => row.title)).toEqual(["Beta"]);
  },
);

test("a provider given another access answers from it, not from the old access's answers", async () => {
  const before = fakePort();
  before.answer(
    "list",
    listAnswer(() => ["Alpha"]),
  );
  const after = fakePort();
  after.answer(
    "list",
    listAnswer(() => ["Beta"]),
  );
  const shown = { access: before.access };
  const list = await renderHook(shown, () => useNoteList({}));
  expect(data(list.current()).map((row) => row.title)).toEqual(["Alpha"]);

  shown.access = after.access;
  await list.redraw();
  await settle();

  expect(listCalls(after)).toBe(1);
  expect(data(list.current()).map((row) => row.title)).toEqual(["Beta"]);
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

test("a provider drawn again with new callbacks keeps its context, so a misuse stays reported once", async () => {
  const port = fakePort();
  const create = notesPort.query("create");
  port.answer("create", () => note("note-0", "Alpha"));
  const problems: string[] = [];
  const reportMisuse = (problem: string) => problems.push(problem);
  const notify = () => {};
  const context = await renderHook(
    port,
    () => {
      create({ title: "Alpha", isPinned: false });
      return useDataContext();
    },
    { reportMisuse, notify },
  );
  const first = context.current();

  await context.redraw();
  port.reconnect();
  await settle();

  expect(context.current()).toBe(first);
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
