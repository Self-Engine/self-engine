// An input error over the real connection (D369): the `notes` test module raises one at the title
// for "Inbox", and the frame's own check raises one for an empty title. Both arrive as the result
// `invalid`, with the issues the Data Process named.

import { msg } from "@lingui/core/macro";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { notes, notesContract } from "@self-engine/storage/testing";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { createDataConnection, type DataConnection } from "../index.ts";
import { fixedAnswers } from "../testing/index.ts";
import { type DataAccess, type InputReasonOf, portAccessOf, portHooks } from "./index.ts";
import { UNEXPECTED_NOTICE } from "./operation-hook.ts";

const notesPort = portHooks<typeof notesContract>("notes");
const createNote = notesPort.run("create", {
  conflicts: { title_taken: { text: msg`A note with this title already exists.`, field: "title" } },
});
const listNotes = (data: DataAccess) => data.access.call("notes", "list", {});

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

/** The notes module in a fresh test Data Process, with the notices and Table Changes it gave. */
async function connect() {
  const process = await startTestDataProcess({ modules: { notes } });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);
  const changes: string[][] = [];
  let changed = () => {};
  cleanups.push(
    connection.onTablesChanged((tables) => {
      changes.push([...tables]);
      changed();
    }),
  );
  const notices: unknown[] = [];
  const data: DataAccess = {
    access: portAccessOf(connection),
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => notices.push(notice),
  };
  /** Waits until `count` Table Changes have arrived. */
  const untilChanges = (count: number) =>
    new Promise<void>((resolve) => {
      changed = () => {
        if (changes.length >= count) resolve();
      };
      changed();
    });
  return { data, notices, changes, untilChanges };
}

test("an input error the Operation raises arrives as invalid, at its path with its reason, and writes nothing", async () => {
  const { data, notices, changes, untilChanges } = await connect();

  // A Command: no field shows the issue, so the general notice tells the user.
  const result = await createNote(data, { title: "Inbox", isPinned: false });

  expect(result).toEqual({
    status: "invalid",
    issues: [
      {
        field: "title",
        path: ["title"],
        reason: "title_reserved",
        issue: expect.objectContaining({ code: "custom" }),
      },
    ],
    atFields: [],
  });
  expect(notices).toEqual([UNEXPECTED_NOTICE]);
  // Nothing was written, and the next write gives the first Table Change.
  await expect(listNotes(data)).resolves.toEqual([]);
  await createNote(data, { title: "Groceries", isPinned: false });
  await untilChanges(1);
  expect(changes).toEqual([["notes"]]);
});

test("an input error of the frame's own check takes the same way, without a reason", async () => {
  const { data } = await connect();

  const result = await createNote(data, { title: "", isPinned: false });

  expect(result).toMatchObject({
    status: "invalid",
    issues: [
      {
        field: "title",
        path: ["title"],
        reason: undefined,
        issue: { code: "too_small", minimum: 1 },
      },
    ],
  });
});

test("a Fixed Answer with the declared reason gives a caller the same result", async () => {
  const { data } = await connect();
  const fixed: DataAccess = {
    ...data,
    access: fixedAnswers(
      { notes: notesContract },
      { notes: { create: { invalid: [{ path: ["title"], reason: "title_reserved" }] } } },
    ),
  };
  const input = { title: "Inbox", isPinned: false };

  expect(await createNote(fixed, input)).toEqual(await createNote(data, input));
});

test("the reasons a Fixed Answer may give are the ones the entry declares", () => {
  expectTypeOf<InputReasonOf<typeof notesContract, "create">>().toEqualTypeOf<"title_reserved">();
  expectTypeOf<InputReasonOf<typeof notesContract, "update">>().toBeNever();
  expect(() =>
    fixedAnswers(
      { notes: notesContract },
      {
        notes: {
          // @ts-expect-error -- not a reason `create` declares
          create: { invalid: [{ path: ["title"], reason: "title_taken" }] },
          // @ts-expect-error -- `update` declares no input error
          update: { invalid: [{ path: ["title"], reason: "title_reserved" }] },
        },
      },
    ),
  ).toThrow("Fixed Answer for notes.create does not fit its declared input errors");
});
