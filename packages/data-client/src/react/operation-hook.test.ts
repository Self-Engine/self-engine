// @vitest-environment happy-dom
// The Operation hook (D251) at its seam: hooks built for the `notes` test module, rendered against
// a substituted Port access. Its answers are the errors the `notes` Data Process sends: a conflict
// with its reason, "not found", or anything else.

import { msg } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import type { notesContract } from "@self-engine/storage/testing";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  fakePort,
  held,
  renderHook,
  settle,
  type ShownNotices,
  unmountHook,
} from "./hook-harness.ts";
import { type DataAccess, portHooks, useDataAccess } from "./index.ts";
import { NOT_FOUND_NOTICE, UNEXPECTED_NOTICE } from "./operation-hook.ts";

const notesPort = portHooks<typeof notesContract>("notes");
const TITLE_TAKEN = msg`A note with this title already exists.`;
const useRenameNote = notesPort.operation("update", {
  conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
});

const T0 = "2026-11-13T09:00:00.000Z";

function note(id: string, title: string) {
  return { id, createdAt: T0, updatedAt: T0, title, isPinned: false };
}

const RENAME = { id: "note-0" as never, title: "Beta" };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  unmountHook();
  vi.useRealTimers();
});

test("a successful Operation returns its data, and the hook reports running until then", async () => {
  const port = fakePort();
  const answer = held<ReturnType<typeof note>>();
  port.answer("update", () => answer.promise);
  const notices: ShownNotices = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notify: (notice) => notices.push(notice),
  });
  expect(rename.current().running).toBe(false);

  let result: unknown;
  act(() => {
    void rename
      .current()
      .run(RENAME)
      .then((value) => (result = value));
  });
  await settle();
  expect(rename.current().running).toBe(true);
  expect(port.calls).toEqual([{ module: "notes", entry: "update", input: RENAME }]);

  answer.resolve(note("note-0", "Beta"));
  await settle();
  expect(result).toEqual({ status: "success", data: note("note-0", "Beta") });
  expect(rename.current().running).toBe(false);
  expect(notices).toEqual([]);
});

test("the hook reports running while any of its calls is outstanding, and only its own", async () => {
  const port = fakePort();
  const first = held<ReturnType<typeof note>>();
  const second = held<ReturnType<typeof note>>();
  const answers = [first, second];
  port.answer("update", () => answers.shift()?.promise);
  const rename = await renderHook(port, () => ({ mine: useRenameNote(), other: useRenameNote() }));

  act(() => {
    void rename.current().mine.run(RENAME);
    void rename.current().mine.run(RENAME);
  });
  await settle();
  expect(rename.current().mine.running).toBe(true);
  expect(rename.current().other.running).toBe(false);

  // The later call ends first; the earlier one still runs.
  second.resolve(note("note-0", "Beta"));
  await settle();
  expect(rename.current().mine.running).toBe(true);

  first.resolve(note("note-0", "Beta"));
  await settle();
  expect(rename.current().mine.running).toBe(false);
});

/** Runs the Operation once and lets its answer in. */
async function runOnce<Result>(
  rendered: { current(): { run(input: typeof RENAME): Promise<Result> } },
  input = RENAME,
): Promise<Result> {
  let result: Result | undefined;
  act(() => {
    void rendered
      .current()
      .run(input)
      .then((value) => (result = value));
  });
  await settle();
  if (result === undefined) throw new Error("The Operation has not answered");
  return result;
}

test("a conflict returns its reason with the module's text and field, and shows no notice", async () => {
  const port = fakePort();
  port.answer("update", () => {
    throw new ORPCError("CONFLICT", { data: { reason: "title_taken" } });
  });
  const notices: ShownNotices = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notify: (notice) => notices.push(notice),
  });

  const result = await runOnce(rename);

  expect(result).toEqual({
    status: "conflict",
    reason: "title_taken",
    field: "title",
    text: TITLE_TAKEN,
  });
  expect(rename.current().running).toBe(false);
  expect(notices).toEqual([]);
});

test('"not found" returns as a value and shows its default notice once', async () => {
  const port = fakePort();
  port.answer("update", () => {
    throw new ORPCError("NOT_FOUND");
  });
  const notices: ShownNotices = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notify: (notice) => notices.push(notice),
  });

  expect(await runOnce(rename)).toEqual({ status: "notFound" });
  expect(notices).toEqual([NOT_FOUND_NOTICE]);
});

test('a module\'s replacement for "not found" runs instead of the default notice', async () => {
  const replaced: unknown[] = [];
  const useRenameGoneNote = notesPort.operation("update", {
    conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
    notFound: (input) => replaced.push(input.id),
  });
  const port = fakePort();
  port.answer("update", () => {
    throw new ORPCError("NOT_FOUND");
  });
  const notices: ShownNotices = [];
  const rename = await renderHook(port, () => useRenameGoneNote(), {
    notify: (notice) => notices.push(notice),
  });

  expect(await runOnce(rename)).toEqual({ status: "notFound" });
  expect(replaced).toEqual(["note-0"]);
  expect(notices).toEqual([]);
});

test.each([
  ["an error of the Data Process", new ORPCError("INTERNAL_SERVER_ERROR")],
  ["a lost connection", new Error("The port closed")],
  [
    "a conflict reason the entry does not declare",
    new ORPCError("CONFLICT", { data: { reason: "x" } }),
  ],
  ["rejected input", new ORPCError("BAD_REQUEST")],
])("%s returns as unexpected and shows the general notice once", async (_case, error) => {
  const port = fakePort();
  port.answer("update", () => Promise.reject(error));
  const notices: ShownNotices = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notify: (notice) => notices.push(notice),
  });

  expect(await runOnce(rename)).toEqual({ status: "unexpected", error });
  expect(rename.current().running).toBe(false);
  expect(notices).toEqual([UNEXPECTED_NOTICE]);
});

test("the Operation's input, result and conflict texts are typed from the module's Contract", () => {
  // Compile-time checks: the type check of `pnpm verify` fails if any expectation breaks.
  const typed = async () => {
    const result = await useRenameNote().run(RENAME);
    if (result.status === "success") {
      const title: string = result.data.title;
      void title;
    }
    if (result.status === "conflict") {
      const reason: "title_taken" = result.reason;
      const field: "id" | "title" | null = result.field;
      void [reason, field];
    }
    // @ts-expect-error `update` needs a title.
    void useRenameNote().run({ id: RENAME.id });
    // `get` declares no conflict, so its result has none and it needs no texts.
    const found = await notesPort.operation("get")().run({ id: RENAME.id });
    // @ts-expect-error No conflict variant without a declared conflict.
    void (found.status === "conflict");
  };
  // @ts-expect-error The text for the declared reason `title_taken` is left out.
  notesPort.operation("update", { conflicts: {} });
  // @ts-expect-error An entry that declares a conflict needs its texts.
  notesPort.operation("create");
  notesPort.operation("create", {
    // @ts-expect-error A conflict points at a field of the entry's input.
    conflicts: { title_taken: { text: TITLE_TAKEN, field: "name" } },
  });
  notesPort.operation("create", {
    // @ts-expect-error Every reason states its field, `null` when it has none.
    conflicts: { title_taken: { text: TITLE_TAKEN } },
  });
  // A reason without a field of its own states so.
  notesPort.operation("create", { conflicts: { title_taken: { text: TITLE_TAKEN, field: null } } });
  notesPort.operation("create", {
    conflicts: {
      title_taken: { text: TITLE_TAKEN, field: "title" },
      // @ts-expect-error `create` declares no reason `other`.
      other: { text: TITLE_TAKEN, field: "title" },
    },
  });
  // @ts-expect-error A misspelled entry is not in the Contract.
  notesPort.operation("updaet");
  expect(typeof typed).toBe("function");
});

// The same Operation as a function, for code outside React such as a Command (D261): it takes the
// Port access and the notice seam the caller was given, and answers and notifies as the hook does.
const renameNote = notesPort.run("update", {
  conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
});

/** What a Command is given: the fake Port's access, and a list that collects the notices. */
function commandData(port: { readonly access: DataAccess["access"] }) {
  const notices: ShownNotices = [];
  const data: DataAccess = { access: port.access, notify: (notice) => notices.push(notice) };
  return { data, notices };
}

test("the function form returns the same results as the hook, over the access it is given", async () => {
  const port = fakePort();
  const { data, notices } = commandData(port);
  port.answer("update", (input) => note("note-0", (input as typeof RENAME).title));
  expect(await renameNote(data, RENAME)).toEqual({
    status: "success",
    data: note("note-0", "Beta"),
  });
  port.answer("update", () =>
    Promise.reject(new ORPCError("CONFLICT", { data: { reason: "title_taken" } })),
  );
  expect(await renameNote(data, RENAME)).toEqual({
    status: "conflict",
    reason: "title_taken",
    field: "title",
    text: TITLE_TAKEN,
  });
  expect(port.calls).toHaveLength(2);
  expect(notices).toEqual([]);
});

test.each([
  ['"not found"', new ORPCError("NOT_FOUND"), { status: "notFound" }, NOT_FOUND_NOTICE],
  [
    "an unexpected error",
    new ORPCError("INTERNAL_SERVER_ERROR"),
    { status: "unexpected" },
    UNEXPECTED_NOTICE,
  ],
])(
  "the function form announces %s through the notice seam it is given, as the hook does",
  async (_case, error, result, notice) => {
    const port = fakePort();
    const { data, notices } = commandData(port);
    port.answer("update", () => Promise.reject(error));
    expect(await renameNote(data, RENAME)).toMatchObject(result);
    expect(notices).toEqual([notice]);
  },
);

// A conflict without a field to show it at, such as undo's: the module says so with `field: null`,
// and the building block shows the text as a notice itself.
const GONE_TITLE = msg`The note could not come back: another note has its title now.`;
const restoreHandling = { conflicts: { title_taken: { text: GONE_TITLE, field: null } } } as const;
const TAKEN = new ORPCError("CONFLICT", { data: { reason: "title_taken" } });

test("a conflict whose reason has no field returns the conflict and shows its text once", async () => {
  const useRestoreNote = notesPort.operation("update", restoreHandling);
  const port = fakePort();
  port.answer("update", () => Promise.reject(TAKEN));
  const notices: ShownNotices = [];
  const restore = await renderHook(port, () => useRestoreNote(), {
    notify: (notice) => notices.push(notice),
  });

  expect(await runOnce(restore)).toEqual({
    status: "conflict",
    reason: "title_taken",
    field: null,
    text: GONE_TITLE,
  });
  expect(notices).toEqual([GONE_TITLE]);
});

test("the function form shows a conflict without a field through its notice seam too", async () => {
  const restoreNote = notesPort.run("update", restoreHandling);
  const port = fakePort();
  const { data, notices } = commandData(port);
  port.answer("update", () => Promise.reject(TAKEN));

  expect(await restoreNote(data, RENAME)).toMatchObject({ status: "conflict", field: null });
  expect(notices).toEqual([GONE_TITLE]);
});

test("the function form is typed from the Contract like the hook", () => {
  const typed = async () => {
    const data = commandData(fakePort()).data;
    const result = await renameNote(data, RENAME);
    if (result.status === "conflict") {
      const field: "id" | "title" | null = result.field;
      void field;
    }
    // @ts-expect-error `update` needs a title.
    void renameNote(data, { id: RENAME.id });
    // @ts-expect-error The function form takes the notice seam with the access.
    void renameNote(fakePort().access, RENAME);
  };
  // @ts-expect-error An entry that declares a conflict needs its texts.
  notesPort.run("create");
  expect(typeof typed).toBe("function");
});

test("the provider gives code below it its access and notice seam, to hand to a function form", async () => {
  const port = fakePort();
  const notices: ShownNotices = [];
  const data = await renderHook(port, () => useDataAccess(), {
    notify: (notice) => notices.push(notice),
  });
  port.answer("update", () => Promise.reject(new ORPCError("NOT_FOUND")));

  expect(data.current().access).toBe(port.access);
  await renameNote(data.current(), RENAME);
  expect(notices).toEqual([NOT_FOUND_NOTICE]);
});
