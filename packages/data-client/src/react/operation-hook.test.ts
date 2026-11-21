// @vitest-environment happy-dom
// The Operation hook (D251) at its seam: hooks built for the `notes` test module, rendered against
// a substituted Port access. Its answers are the errors the `notes` Data Process sends: a conflict
// with its reason, "not found", or anything else.

import { msg } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { findReason } from "@self-engine/data-protocol";
import { createI18n } from "@self-engine/i18n";
import { type notesContract, type NotesTables, pinnedNote } from "@self-engine/storage/testing";
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
import {
  type DataAccess,
  portHooks,
  type RefusedNotice,
  refusalTexts,
  useDataAccess,
  useReasonTexts,
} from "./index.ts";
import { NOT_FOUND_NOTICE, type RunOptions, UNEXPECTED_NOTICE } from "./operation-hook.ts";

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
async function runOnce<Result, Options = never>(
  rendered: { current(): { run(input: typeof RENAME, options?: Options): Promise<Result> } },
  input = RENAME,
  options?: Options,
): Promise<Result> {
  let result: Result | undefined;
  act(() => {
    void rendered
      .current()
      .run(input, options)
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

// A Refusal (D334), as the Data Process sends it when a Protection Rule refuses the write: the
// error `REFUSED` with every Reason. Here the `notes` module's own Reason: a pinned note stays.
const PINNED = {
  code: "pinned",
  severity: "blocking",
  table: "notes",
  row: "note-0",
  details: { title: "Groceries" },
} as const;
const AT_FIELD = { ...PINNED, field: "title" } as const;
const REFUSED = new ORPCError("REFUSED", { status: 422, data: { reasons: [PINNED, AT_FIELD] } });
const ARCHIVE = msg`Archive`;

test("a Refusal returns as a result of its own and shows the shared Notice with every Reason", async () => {
  const port = fakePort();
  port.answer("update", () => Promise.reject(REFUSED));
  const notices: ShownNotices = [];
  const refusals: RefusedNotice[] = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => refusals.push(notice),
  });

  expect(await runOnce(rename)).toEqual({
    status: "refused",
    reasons: [PINNED, AT_FIELD],
    atFields: [],
  });
  expect(rename.current().running).toBe(false);
  expect(refusals).toEqual([{ reasons: [PINNED, AT_FIELD] }]);
  // A Refusal is not an error: no notice of one, and nothing to undo.
  expect(notices).toEqual([]);
});

test("a page names the entry and adds one action to the Notice of a Refusal", async () => {
  const port = fakePort();
  port.answer("update", () => Promise.reject(REFUSED));
  const refusals: RefusedNotice[] = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notifyRefused: (notice) => refusals.push(notice),
  });
  const archive = { label: ARCHIVE, run: vi.fn() };

  let result: unknown;
  act(() => {
    void rename
      .current()
      .run(RENAME, { entry: "Groceries", action: archive })
      .then((value) => (result = value));
  });
  await settle();

  expect(result).toEqual({ status: "refused", reasons: [PINNED, AT_FIELD], atFields: [] });
  expect(refusals).toEqual([{ reasons: [PINNED, AT_FIELD], entry: "Groceries", action: archive }]);
});

test("a page's options add to the Notice of a Refusal and never replace its Reasons", async () => {
  const port = fakePort();
  port.answer("update", () => Promise.reject(REFUSED));
  const refusals: RefusedNotice[] = [];
  const rename = await renderHook(port, () => useRenameNote(), {
    notifyRefused: (notice) => refusals.push(notice),
  });
  // A variable passes the type check with more than the options name, as a spread could bring.
  const options = { entry: "Groceries", reasons: [] };

  await runOnce(rename, RENAME, options);

  expect(refusals).toEqual([{ reasons: [PINNED, AT_FIELD], entry: "Groceries" }]);
});

test("a page narrows a Refusal to one Reason by its definition and reads its details typed", async () => {
  const port = fakePort();
  port.answer("update", () => Promise.reject(REFUSED));
  const rename = await renderHook(port, () => useRenameNote());

  const result = await runOnce(rename);
  if (result.status !== "refused") throw new Error("The rename was not refused");
  const pinned = findReason(result, pinnedNote);

  expect(pinned).toEqual(PINNED);
  const title: string | undefined = pinned?.details.title;
  expect(title).toBe("Groceries");
  // @ts-expect-error The details of `pinned` have no `titel`.
  void pinned?.details.titel;
  // @ts-expect-error Only a refused result carries Reasons.
  void (() => findReason({ status: "notFound" }, pinnedNote));
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
  const refusals: RefusedNotice[] = [];
  const data: DataAccess = {
    access: port.access,
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => refusals.push(notice),
  };
  return { data, notices, refusals };
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

test("the function form returns a Refusal as the hook does and shows its Notice through its seam", async () => {
  const port = fakePort();
  const { data, notices, refusals } = commandData(port);
  port.answer("update", () => Promise.reject(REFUSED));

  const result = await renameNote(data, RENAME, { entry: "Groceries" });

  expect(result).toEqual({ status: "refused", reasons: [PINNED, AT_FIELD], atFields: [] });
  expect(result.status === "refused" && findReason(result, pinnedNote)?.details.title).toBe(
    "Groceries",
  );
  expect(refusals).toEqual([{ reasons: [PINNED, AT_FIELD], entry: "Groceries" }]);
  expect(notices).toEqual([]);
});

test("a caller that shows a Refusal itself gets it instead of the announcement", async () => {
  const shown: unknown[] = [];
  const renameShowing = notesPort.run("update", {
    conflicts: { title_taken: { text: TITLE_TAKEN, field: "title" } },
    refused: (refusal, input) => shown.push([refusal.reasons.length, input.title]),
  });
  const port = fakePort();
  const { data, notices, refusals } = commandData(port);
  port.answer("update", () => Promise.reject(REFUSED));

  expect(await renameShowing(data, RENAME)).toMatchObject({ status: "refused" });
  expect(shown).toEqual([[2, "Beta"]]);
  expect(refusals).toEqual([]);
  expect(notices).toEqual([]);
});

test("a Refusal whose Reasons do not have the shape of the refusal block is unexpected", async () => {
  const port = fakePort();
  const { data, notices } = commandData(port);
  const malformed = new ORPCError("REFUSED", { status: 422, data: { reasons: [] } });
  port.answer("update", () => Promise.reject(malformed));

  expect(await renameNote(data, RENAME)).toEqual({ status: "unexpected", error: malformed });
  expect(notices).toEqual([UNEXPECTED_NOTICE]);
});

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

// A Reason that names a column (D334): the module names the input field for each column of its
// tables where it names the field of a Conflict, and the form shows such a Reason at its field.
const tablesPort = portHooks<typeof notesContract, NotesTables>("notes");
const titleTaken = { title_taken: { text: TITLE_TAKEN, field: "title" } } as const;
const useRenameAtField = tablesPort.operation("update", {
  conflicts: titleTaken,
  columns: { notes: { title: "title" } },
});

/**
 * Renders the rename that maps the column `title`, collecting its Notices; it runs as a form that
 * shows the field `title` unless `options` say otherwise.
 */
async function renameAtField(
  answer: ORPCError<string, unknown>,
  options: RunOptions<"id" | "title"> = { showsField: (field) => field === "title" },
) {
  const port = fakePort();
  port.answer("update", () => Promise.reject(answer));
  const notices: ShownNotices = [];
  const refusals: RefusedNotice[] = [];
  const rename = await renderHook(port, () => useRenameAtField(), {
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => refusals.push(notice),
  });
  return { result: await runOnce(rename, RENAME, options), notices, refusals };
}

const refusedWith = (...reasons: readonly object[]) =>
  new ORPCError("REFUSED", { status: 422, data: { reasons } });

test("a Reason at a mapped column is left to the form at its field, and the Notice shows the others", async () => {
  const { result, notices, refusals } = await renameAtField(REFUSED);

  expect(result).toEqual({
    status: "refused",
    reasons: [PINNED, AT_FIELD],
    atFields: [{ field: "title", reason: AT_FIELD }],
  });
  expect(refusals).toEqual([{ reasons: [PINNED] }]);
  expect(notices).toEqual([]);
});

test("a Reason at a mapped column whose field the caller does not show goes to the Notice", async () => {
  // A form without the field, and a caller that is no form, such as a button of the drawer.
  for (const options of [{ showsField: () => false }, {}]) {
    const { result, refusals } = await renameAtField(REFUSED, options);

    expect(result).toEqual({ status: "refused", reasons: [PINNED, AT_FIELD], atFields: [] });
    expect(refusals).toEqual([{ reasons: [PINNED, AT_FIELD] }]);
  }
});

test("a Refusal whose every Reason is at a mapped field shows no Notice", async () => {
  const { result, notices, refusals } = await renameAtField(refusedWith(AT_FIELD));

  expect(result).toMatchObject({ atFields: [{ field: "title", reason: AT_FIELD }] });
  expect(refusals).toEqual([]);
  expect(notices).toEqual([]);
});

test("a Reason at a column the module does not map, or of another table, goes to the Notice", async () => {
  const unmapped = { ...PINNED, field: "is_pinned" };
  const otherTable = { ...AT_FIELD, table: "note_links" };

  const { result, refusals } = await renameAtField(refusedWith(unmapped, otherTable));

  expect(result).toMatchObject({ atFields: [] });
  expect(refusals).toEqual([{ reasons: [unmapped, otherTable] }]);
});

test("a caller that shows a Refusal itself gets only the Reasons no field shows", async () => {
  const shown: unknown[] = [];
  const useRenameShowing = tablesPort.operation("update", {
    conflicts: titleTaken,
    columns: { notes: { title: "title" } },
    refused: (refusal) => shown.push(refusal.reasons),
  });
  const port = fakePort();
  port.answer("update", () => Promise.reject(REFUSED));
  const rename = await renderHook(port, () => useRenameShowing());
  const showsTitle: RunOptions<"id" | "title"> = { showsField: (field) => field === "title" };

  await runOnce(rename, RENAME, showsTitle);
  port.answer("update", () => Promise.reject(refusedWith(AT_FIELD)));
  await runOnce(rename, RENAME, showsTitle);

  expect(shown).toEqual([[PINNED]]);
});

test("a form maps only columns of its module's tables, to fields of the entry's input", () => {
  const typed = async () => {
    const result = await useRenameAtField().run(RENAME);
    if (result.status === "refused") {
      const field: "id" | "title" = result.atFields[0]!.field;
      void field;
    }
  };
  tablesPort.operation("update", {
    conflicts: titleTaken,
    // @ts-expect-error The module has no table `memos`.
    columns: { memos: { title: "title" } },
  });
  tablesPort.operation("update", {
    conflicts: titleTaken,
    // @ts-expect-error The table `notes` has no column `titel`.
    columns: { notes: { titel: "title" } },
  });
  tablesPort.operation("update", {
    conflicts: titleTaken,
    // @ts-expect-error The input of `update` has no field `isPinned`.
    columns: { notes: { is_pinned: "isPinned" } },
  });
  // @ts-expect-error Hooks built without the module's tables map no column.
  notesPort.operation("update", { conflicts: titleTaken, columns: { notes: { title: "title" } } });
  // @ts-expect-error The function form has no field to show a Reason at.
  tablesPort.run("update", { conflicts: titleTaken, columns: { notes: { title: "title" } } });
  expect(typeof typed).toBe("function");
});

test("the provider gives a form the texts of Reasons it was given, to show one at its field", async () => {
  const texts = refusalTexts([], () => undefined);
  const describe = vi.spyOn(texts, "describe").mockReturnValue("The linked note was deleted.");
  const i18n = createI18n();

  const given = await renderHook(fakePort(), () => useReasonTexts(), { reasonTexts: texts });

  expect(given.current().describe(AT_FIELD, i18n)).toBe("The linked note was deleted.");
  expect(describe).toHaveBeenCalledWith(AT_FIELD, i18n);
});

test("new texts given to the provider reach a Reason drawn in the same render", async () => {
  const i18n = createI18n();
  const before = refusalTexts([{ pinned: () => "Before." }], () => undefined);
  const after = refusalTexts([{ pinned: () => "After." }], () => undefined);

  const text = await renderHook(fakePort(), () => useReasonTexts().describe(PINNED, i18n), {
    reasonTexts: before,
  });
  expect(text.current()).toBe("Before.");
  await text.redraw({ reasonTexts: after });

  expect(text.current()).toBe("After.");
});

// An input error (D369): the frame's own check of the input, or one the Operation raises, in the
// same shape. An issue at a field the caller shows is the form's; any other tells the general
// notice, as an unexpected failure does.
const invalidWith = (...issues: readonly object[]) =>
  new ORPCError("BAD_REQUEST", { message: "Input validation failed", data: { issues } });
const RESERVED_ISSUE = {
  code: "custom",
  path: ["title"],
  message: "title_reserved",
  params: { reason: "title_reserved" },
};
const ID_ISSUE = { code: "invalid_type", expected: "string", path: ["id"], message: "Required" };

test("an input error at a field the caller shows returns invalid with that issue, and no notice", async () => {
  const { result, notices } = await renameAtField(invalidWith(RESERVED_ISSUE));

  const issue = {
    field: "title",
    path: ["title"],
    reason: "title_reserved",
    issue: RESERVED_ISSUE,
  };
  expect(result).toEqual({ status: "invalid", issues: [issue], atFields: [issue] });
  expect(notices).toEqual([]);
});

test("an issue at a field the caller does not show tells the general notice once", async () => {
  const { result, notices } = await renameAtField(invalidWith(RESERVED_ISSUE, ID_ISSUE));

  expect(result).toMatchObject({
    status: "invalid",
    issues: [{ field: "title" }, { field: "id", reason: undefined }],
    atFields: [{ field: "title" }],
  });
  expect(notices).toEqual([UNEXPECTED_NOTICE]);
});

test("an issue inside a list names its field by its dotted path", async () => {
  const { result } = await renameAtField(
    invalidWith({ ...RESERVED_ISSUE, path: ["lines", 2, "title"] }),
    {
      showsField: () => false,
    },
  );

  expect(result).toMatchObject({
    issues: [{ field: "lines.2.title", path: ["lines", 2, "title"] }],
  });
});

test.each([
  ["without issues", new ORPCError("BAD_REQUEST")],
  ["with an empty list", invalidWith()],
  ["with an issue without a path", invalidWith({ code: "custom", message: "x" })],
])("an input error %s is unexpected", async (_case, error) => {
  const { result, notices } = await renameAtField(error);

  expect(result).toMatchObject({ status: "unexpected" });
  expect(notices).toEqual([UNEXPECTED_NOTICE]);
});
