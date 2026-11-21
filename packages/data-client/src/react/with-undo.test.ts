// @vitest-environment happy-dom
import { msg } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import type { notesContract } from "@self-engine/storage/testing";
import { undoLatest } from "@self-engine/ui";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { fakePort, renderHook, settle, type ShownNotices, unmountHook } from "./hook-harness.ts";
import { portHooks, type RefusedNotice, useWithUndo } from "./index.ts";
import { NOT_FOUND_NOTICE, UNEXPECTED_NOTICE } from "./operation-hook.ts";

const notesPort = portHooks<typeof notesContract>("notes");
const useDeleteNote = notesPort.operation("delete");
const useRestoreNote = notesPort.operation("restore", {
  conflicts: { title_taken: { text: msg`A note with this title already exists.`, field: null } },
});
const NOTE = { id: "note-0" as never };
const MESSAGE = "Note deleted";

function useDeleteNoteWithUndo() {
  return useWithUndo(useDeleteNote().run, useRestoreNote().run, MESSAGE);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  unmountHook();
  vi.useRealTimers();
});

test("a successful change offers Undo for the same id, even after leaving the Edit Drawer", async () => {
  const port = fakePort();
  port.answer("delete", () => ({}));
  port.answer("restore", () => ({}));
  const remove = await renderHook(port, useDeleteNoteWithUndo);

  await act(async () => {
    expect(await remove.current()(NOTE.id)).toBe(true);
  });
  expect(port.calls).toEqual([{ module: "notes", entry: "delete", input: NOTE }]);

  await remove.show(false);
  act(() => {
    undoLatest();
    undoLatest();
  });
  await settle();
  expect(port.calls).toEqual([
    { module: "notes", entry: "delete", input: NOTE },
    { module: "notes", entry: "restore", input: NOTE },
  ]);
});

test.each([
  ["not found", new ORPCError("NOT_FOUND"), NOT_FOUND_NOTICE, true],
  ["unexpected error", new Error("The Port closed"), UNEXPECTED_NOTICE, false],
] as const)("a change ending in %s leaves no Undo offer", async (_name, error, notice, left) => {
  const port = fakePort();
  port.answer("delete", () => {
    throw error;
  });
  const notices: ShownNotices = [];
  const remove = await renderHook(port, useDeleteNoteWithUndo, {
    notify: (message) => notices.push(message),
  });

  await act(async () => {
    expect(await remove.current()(NOTE.id)).toBe(left);
  });
  act(undoLatest);
  await settle();
  expect(port.calls).toEqual([{ module: "notes", entry: "delete", input: NOTE }]);
  expect(notices).toEqual([notice]);
});

test("a Refusal uses the caller's Notice options and leaves no Undo offer", async () => {
  const reasons = [
    {
      code: "pinned",
      severity: "blocking",
      table: "notes",
      row: NOTE.id,
      details: { title: "Groceries" },
    },
  ] as const;
  const port = fakePort();
  port.answer("delete", () => {
    throw new ORPCError("REFUSED", { data: { reasons } });
  });
  const notices: RefusedNotice[] = [];
  const remove = await renderHook(port, useDeleteNoteWithUndo, {
    notifyRefused: (notice) => notices.push(notice),
  });
  const options = { entry: "Groceries", action: { label: msg`Archive`, run: vi.fn() } };

  await act(async () => {
    expect(await remove.current()(NOTE.id, options)).toBe(false);
  });
  act(undoLatest);
  await settle();
  expect(port.calls).toEqual([{ module: "notes", entry: "delete", input: NOTE }]);
  expect(notices).toEqual([{ reasons, ...options }]);
});

test("the caller and Undo must accept the change's id type", () => {
  function useTypesOnly() {
    const { run: remove } = useDeleteNote();
    const { run: restore } = useRestoreNote();
    const undoOtherEntry = async (_input: { id: number }) => ({ status: "success" as const });
    // @ts-expect-error The inverse Operation needs a different id type.
    useWithUndo(remove, undoOtherEntry, MESSAGE);
    const leave = useWithUndo(remove, restore, MESSAGE);
    // @ts-expect-error The caller must supply the id type of the change.
    void leave(123);
  }
  expect(typeof useTypesOnly).toBe("function");
});
