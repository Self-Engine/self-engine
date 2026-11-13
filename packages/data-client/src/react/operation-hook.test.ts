// @vitest-environment happy-dom
// The Operation hook (D251) at its seam: hooks built for the `notes` test module, rendered against
// a substituted Port access. Its answers are the errors the `notes` Data Process sends: a conflict
// with its reason, "not found", or anything else.

import { msg } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import type { notesContract } from "@self-engine/storage/testing";
import { notifyError } from "@self-engine/ui";
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
import { portHooks, usePortAccess } from "./index.ts";
import { NOT_FOUND_NOTICE, UNEXPECTED_NOTICE } from "./operation-hook.ts";

// The feedback system is replaced, so no notice is drawn; the other tests collect notices instead.
vi.mock("@self-engine/ui", () => ({ notifyError: vi.fn() }));

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
      const field: "id" | "title" = result.field;
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

test("without a collector, the notices go to the feedback system as error notices", async () => {
  const port = fakePort();
  port.answer("update", () => {
    throw new ORPCError("NOT_FOUND");
  });
  const rename = await renderHook(port, () => useRenameNote());

  await runOnce(rename);

  expect(vi.mocked(notifyError)).toHaveBeenCalledOnce();
});

// The same Operation as a function, for code outside React such as a Command (D261): it takes the
// Port access the caller was given, and answers and notifies as the hook does.
const renameNote = notesPort.run("update", {
  conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
});

test("the function form returns the same results as the hook, over the access it is given", async () => {
  const port = fakePort();
  port.answer("update", (input) => note("note-0", (input as typeof RENAME).title));
  expect(await renameNote(port.access, RENAME)).toEqual({
    status: "success",
    data: note("note-0", "Beta"),
  });
  port.answer("update", () =>
    Promise.reject(new ORPCError("CONFLICT", { data: { reason: "title_taken" } })),
  );
  expect(await renameNote(port.access, RENAME)).toEqual({
    status: "conflict",
    reason: "title_taken",
    field: "title",
    text: TITLE_TAKEN,
  });
  expect(port.calls).toHaveLength(2);
  expect(vi.mocked(notifyError)).not.toHaveBeenCalled();
});

test.each([
  ['"not found"', new ORPCError("NOT_FOUND"), { status: "notFound" }],
  ["an unexpected error", new ORPCError("INTERNAL_SERVER_ERROR"), { status: "unexpected" }],
])(
  "the function form announces %s through the feedback system, as the hook does",
  async (_case, error, result) => {
    vi.mocked(notifyError).mockClear();
    const port = fakePort();
    port.answer("update", () => Promise.reject(error));
    expect(await renameNote(port.access, RENAME)).toMatchObject(result);
    expect(vi.mocked(notifyError)).toHaveBeenCalledOnce();
  },
);

test("the function form is typed from the Contract like the hook", () => {
  const typed = async () => {
    const result = await renameNote(fakePort().access, RENAME);
    if (result.status === "conflict") {
      const field: "id" | "title" = result.field;
      void field;
    }
    // @ts-expect-error `update` needs a title.
    void renameNote(fakePort().access, { id: RENAME.id });
  };
  // @ts-expect-error An entry that declares a conflict needs its texts.
  notesPort.run("create");
  expect(typeof typed).toBe("function");
});

test("the provider gives code below it the Port access it was given, to hand to a function form", async () => {
  const port = fakePort();
  const access = await renderHook(port, () => usePortAccess());
  expect(access.current()).toBe(port.access);
});
