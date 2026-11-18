// @vitest-environment happy-dom
// Fixed Answers (D255) at their seam: the Port access a story or component test builds from a
// map of entry to answer, checked against the `notes` test module's Contract.

import { msg } from "@lingui/core/macro";
import { referenced } from "@self-engine/data-protocol";
import { notesContract, pinnedNote } from "@self-engine/storage/testing";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { renderHook, settle, unmountHook } from "../react/hook-harness.ts";
import { portHooks } from "../react/index.ts";
import { answersByMount, fixedAnswers } from "./index.ts";

const notesPort = portHooks<typeof notesContract>("notes");
const useNoteList = notesPort.query("list");
const TITLE_TAKEN = msg`A note with this title already exists.`;
const useRenameNote = notesPort.operation("update", {
  conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  unmountHook();
  vi.useRealTimers();
});

const contracts = { notes: notesContract };

const NOTE = {
  id: "019a7c4e-0000-7000-8000-000000000001",
  createdAt: "2026-11-13T09:00:00.000Z",
  updatedAt: "2026-11-13T09:00:00.000Z",
  title: "Groceries",
  isPinned: false,
};

test("an answer outside the output schema fails and names the entry and the field", () => {
  expect(() =>
    fixedAnswers(contracts, { notes: { list: { data: [NOTE, { ...NOTE, createdAt: "today" }] } } }),
  ).toThrow(/notes\.list.*1\.createdAt/);
});

test("a conflict reason the entry does not declare fails and names the entry", () => {
  expect(() =>
    fixedAnswers(contracts, { notes: { update: { conflict: "too_long" as "title_taken" } } }),
  ).toThrow(/notes\.update.*"too_long"/);
});

test("a call to an entry without an answer fails, and names the entry in its report", async () => {
  const reports: string[] = [];
  const access = fixedAnswers(
    contracts,
    { notes: { list: { data: [] } } },
    { report: (problem) => reports.push(problem) },
  );
  await expect(access.call("notes", "get", { id: NOTE.id })).rejects.toThrow(/notes\.get/);
  expect(reports).toEqual([expect.stringMatching(/notes\.get/)]);
});

test('"not found" for an entry that does not declare it fails and names the entry', () => {
  expect(() => fixedAnswers(contracts, { notes: { list: "notFound" as never } })).toThrow(
    /notes\.list.*not found/,
  );
});

test("an entry the Contract does not have fails and names it", () => {
  expect(() => fixedAnswers(contracts, { notes: { archive: "loading" } as never })).toThrow(
    /notes\.archive/,
  );
});

test("a Query hook shows the data as the output schema returns it", async () => {
  const access = fixedAnswers(contracts, { notes: { list: { data: [NOTE] } } });
  const list = await renderHook({ access }, () => useNoteList({}));
  expect(list.current()).toEqual({ status: "content", data: [NOTE] });
});

test("a held answer keeps a Query hook loading", async () => {
  const access = fixedAnswers(contracts, { notes: { list: "loading" } });
  const list = await renderHook({ access }, () => useNoteList({}));
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(list.current()).toEqual({ status: "loading" });
});

test("an unexpected answer fails a Query hook's first load", async () => {
  const access = fixedAnswers(contracts, { notes: { list: "unexpected" } });
  const list = await renderHook({ access }, () => useNoteList({}));
  expect(list.current().status).toBe("loadFailed");
});

/** Runs the rename Operation once against `access` and returns its result and the notices. */
async function rename(access: ReturnType<typeof fixedAnswers>) {
  const notices: unknown[] = [];
  const hook = await renderHook({ access }, () => useRenameNote(), {
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => notices.push(notice),
  });
  let result: unknown;
  await act(async () => {
    result = await hook.current().run({ id: NOTE.id as never, title: "Errands" });
  });
  await settle();
  return { result, notices };
}

test("an Operation hook gets the conflict, with the module's text and field", async () => {
  const outcome = await rename(
    fixedAnswers(contracts, { notes: { update: { conflict: "title_taken" } } }),
  );
  expect(outcome).toEqual({
    result: { status: "conflict", reason: "title_taken", field: "title", text: TITLE_TAKEN },
    notices: [],
  });
});

test('an Operation hook gets "not found", and its notice shows', async () => {
  const { result, notices } = await rename(
    fixedAnswers(contracts, { notes: { update: "notFound" } }),
  );
  expect(result).toEqual({ status: "notFound" });
  expect(notices).toHaveLength(1);
});

test("an Operation returns its Fixed Answer and changes nothing", async () => {
  const access = fixedAnswers(contracts, {
    notes: { list: { data: [NOTE] }, update: { data: { ...NOTE, title: "Errands" } } },
  });
  const { result } = await rename(access);
  expect(result).toEqual({ status: "success", data: { ...NOTE, title: "Errands" } });
  await expect(access.call("notes", "list", {})).resolves.toEqual([NOTE]);
});

// A Refusal is checked against the Reason definitions the story passes, as a conflict is checked
// against the Contract: the frame's own and a module's alike.
const PINNED = {
  code: "pinned",
  table: "notes",
  row: NOTE.id,
  details: { title: "Groceries" },
} as const;

test("an Operation hook gets the Refusal with every Reason, blocking as the frame sets it", async () => {
  const referencedBy = {
    code: "referenced" as const,
    table: "notes",
    row: NOTE.id,
    details: { tables: [{ table: "attachments", count: 2 }] },
  };
  const access = fixedAnswers(
    contracts,
    { notes: { update: { refused: [PINNED, { ...referencedBy, field: "title" }] } } },
    { reasons: [pinnedNote, referenced] },
  );

  const { result, notices } = await rename(access);

  expect(result).toEqual({
    status: "refused",
    reasons: [
      { ...PINNED, severity: "blocking" },
      { ...referencedBy, field: "title", severity: "blocking" },
    ],
    atFields: [],
  });
  // The shared Notice of a Refusal, with every Reason.
  expect(notices).toEqual([{ reasons: (result as { reasons: unknown }).reasons }]);
});

test("a Reason nobody defined fails and names the entry and its code", () => {
  expect(() =>
    fixedAnswers(
      contracts,
      // @ts-expect-error The story passes no definition of `pinned`.
      { notes: { update: { refused: [PINNED] } } },
      { reasons: [referenced] },
    ),
  ).toThrow(/notes\.update.*"pinned"/);
  // @ts-expect-error Without definitions, a story cannot fix a Refusal.
  void (() => fixedAnswers(contracts, { notes: { update: { refused: [PINNED] } } }));
});

test("a Reason whose details do not fit its definition fails and names the detail", () => {
  expect(() =>
    fixedAnswers(
      contracts,
      // @ts-expect-error The details of `pinned` have a title.
      { notes: { update: { refused: [{ ...PINNED, details: { name: "Groceries" } }] } } },
      { reasons: [pinnedNote] },
    ),
  ).toThrow(/notes\.update.*"pinned".*title/);
});

test("a Refusal for an entry that cannot refuse fails and names the entry", () => {
  expect(() =>
    fixedAnswers(contracts, { notes: { get: { refused: [PINNED] } } }, { reasons: [pinnedNote] }),
  ).toThrow(/notes\.get.*refus/);
});

test("answers by mount send each call to the access of its mount", async () => {
  const notes = fixedAnswers(contracts, { notes: { list: { data: [NOTE] } } });
  const archive = fixedAnswers({ archive: notesContract }, { archive: { list: { data: [] } } });
  const access = answersByMount({ notes, archive });

  await expect(access.call("notes", "list", {})).resolves.toEqual([NOTE]);
  await expect(access.call("archive", "list", {})).resolves.toEqual([]);
});

test("answers by mount fail a call to a mount without an access and name the entry", async () => {
  const reports: string[] = [];
  const access = answersByMount(
    { notes: fixedAnswers(contracts, { notes: { list: { data: [NOTE] } } }) },
    { report: (problem) => reports.push(problem) },
  );

  await expect(access.call("backups", "list", {})).rejects.toThrow(
    "No Fixed Answer for backups.list, which the story called.",
  );
  expect(reports).toEqual(["No Fixed Answer for backups.list, which the story called."]);
});
