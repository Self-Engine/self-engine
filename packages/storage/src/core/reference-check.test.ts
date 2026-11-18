import { createRouterClient } from "@orpc/server";
import { referencesOf, type Database, type TablesOf } from "@self-engine/db";
import { createSpaceRows, FIRST_SPACE_ID, SECOND_SPACE_ID } from "@self-engine/spaces/testing";
import type { Instant } from "@self-engine/time";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { links } from "../../test/note-links-module/data/index.ts";
import { notes } from "../../test/notes-module/data/index.ts";
import type { notesRowMap } from "../../test/notes-module/data/rows.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";
import { recordStatements } from "../testing/statements.ts";
import {
  createContext,
  createFrame,
  protectionRules,
  referenceCheck,
  sharedWrites,
  type ProtectionRules,
} from "./index.ts";
import { askRules } from "./rules.ts";

/**
 * Tables beside `notes` and `note_links` that only this test needs: a second referring table
 * whose rows can be archived, a Local Table that refers to a note, and a tree.
 */
const MORE_TABLES = `
  CREATE TABLE note_tags (
    id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    archived_at TEXT,
    space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
    note_id TEXT NOT NULL REFERENCES notes(id) DEFERRABLE INITIALLY DEFERRED
  ) STRICT;
  CREATE INDEX note_tags_note ON note_tags (note_id) WHERE deleted_at IS NULL;
  CREATE TABLE local_note_marks (
    note_id TEXT NOT NULL REFERENCES notes(id) DEFERRABLE INITIALLY DEFERRED
  ) STRICT;
  CREATE TABLE folders (
    id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    archived_at TEXT,
    space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
    parent_id TEXT REFERENCES folders(id) DEFERRABLE INITIALLY DEFERRED
  ) STRICT;
  CREATE INDEX folders_parent ON folders (parent_id) WHERE deleted_at IS NULL;
`;

interface Synced {
  id: string;
  space_id: string;
  created_at: Instant;
  updated_at: Instant;
  deleted_at: Instant | null;
}
type Tables = TablesOf<typeof notesRowMap> & {
  note_links: Synced & { note_id: string; label: string };
  note_tags: Synced & { archived_at: Instant | null; note_id: string };
  local_note_marks: { note_id: string };
  folders: Synced & { archived_at: Instant | null; parent_id: string | null };
  spaces: Synced;
};

let database: Database;
let rules: ProtectionRules;
let calls: ReturnType<typeof frameClient>;
const client = () => calls;
let recorded: ReturnType<typeof recordStatements>;
/** Every statement run since the last `ran.length = 0`. */
let ran: ReturnType<typeof recordStatements>["statements"];

beforeEach(async () => {
  database = await createTestDatabase(
    { migrations: [{ name: "reference-check/0001", sql: MORE_TABLES }] },
    [notes, links],
  );
  recorded = recordStatements(database);
  ran = recorded.statements;
  await createSpaceRows(database.kysely, [{ id: SECOND_SPACE_ID }]);
  rules = protectionRules([referenceCheck(await referencesOf(database))]);
  calls = frameClient();
  ran.length = 0;
});
afterEach(async () => {
  await database.close();
});

function frameClient() {
  return createRouterClient(
    createFrame(notes, {
      database: { ...database, kysely: database.kysely.withPlugin(recorded.plugin) },
      sources: { ...createTestContext(), rules },
      checkOutputs: true,
    }),
  );
}

const db = () => database.kysely.withTables<Tables>();
const now = "2026-11-12T12:00:00.000Z" as Instant;
let counter = 0;
function row(spaceId: string = FIRST_SPACE_ID) {
  counter += 1;
  return {
    id: `01a1c0a2-f079-7000-8000-${String(counter).padStart(12, "0")}`,
    space_id: spaceId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}
async function link(noteId: string, values: { space_id?: string; deleted_at?: Instant } = {}) {
  await db()
    .insertInto("note_links")
    .values({ ...row(), note_id: noteId, label: "Link", ...values })
    .execute();
}
async function tag(noteId: string, archived: boolean) {
  await db()
    .insertInto("note_tags")
    .values({ ...row(), note_id: noteId, archived_at: archived ? now : null })
    .execute();
}

function referencedBy(note: string, tables: { table: string; count: number }[], table = "notes") {
  return { code: "referenced", severity: "blocking", table, row: note, details: { tables } };
}

async function refusalOf(write: Promise<unknown>) {
  const error: unknown = await write.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toMatchObject({ code: "REFUSED" });
  return (error as { data: { reasons: unknown[] } }).data.reasons;
}

test("a row that Live Rows of two tables refer to is refused with each table and its count; an archived one protects too", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  await link(note.id);
  await link(note.id);
  await tag(note.id, true);

  await expect(refusalOf(client().delete({ id: note.id }))).resolves.toEqual([
    referencedBy(note.id, [
      { table: "note_links", count: 2 },
      { table: "note_tags", count: 1 },
    ]),
  ]);
  await expect(client().get({ id: note.id })).resolves.toEqual(note);
});

test("a deleted referring row protects nothing", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  await link(note.id, { deleted_at: now });

  await expect(client().delete({ id: note.id })).resolves.toMatchObject({ id: note.id });
});

test("a referring row of another Space protects", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  await link(note.id, { space_id: SECOND_SPACE_ID });

  await expect(refusalOf(client().delete({ id: note.id }))).resolves.toEqual([
    referencedBy(note.id, [{ table: "note_links", count: 1 }]),
  ]);
});

test("a reference from a Local Table protects nothing", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  await db().insertInto("local_note_marks").values({ note_id: note.id }).execute();

  await expect(client().delete({ id: note.id })).resolves.toMatchObject({ id: note.id });
});

test("space_id is not a reference: a Space its rows live in is not protected by them", async () => {
  await client().create({ title: "In the Space", isPinned: false });

  await database.kysely.transaction().execute(async (transaction) => {
    const writes = sharedWrites(
      transaction.withTables<Tables>(),
      createContext({ ...createTestContext(), rules }),
    );
    await expect(writes.softDelete("spaces", FIRST_SPACE_ID)).resolves.toMatchObject({
      id: FIRST_SPACE_ID,
    });
  });
});

test("in a tree a parent with a live child is refused; once the child is deleted, it is not", async () => {
  const parent = row();
  const child = row();
  await db()
    .insertInto("folders")
    .values([
      { ...parent, archived_at: null, parent_id: null },
      { ...child, archived_at: null, parent_id: parent.id },
    ])
    .execute();
  const deleteFolder = (id: string) =>
    database.kysely
      .transaction()
      .execute((transaction) =>
        sharedWrites(
          transaction.withTables<Tables>(),
          createContext({ ...createTestContext(), rules }),
        ).softDelete("folders", id),
      );

  await expect(refusalOf(deleteFolder(parent.id))).resolves.toEqual([
    referencedBy(parent.id, [{ table: "folders", count: 1 }], "folders"),
  ]);
  await deleteFolder(child.id);
  await expect(deleteFolder(parent.id)).resolves.toMatchObject({ id: parent.id });
});

test("handed several rows, the rule answers per row and asks each referring table as often as for one", async () => {
  const first = await client().create({ title: "First", isPinned: false });
  const second = await client().create({ title: "Second", isPinned: false });
  const loose = await client().create({ title: "Loose", isPinned: false });
  await link(first.id);
  await tag(second.id, false);
  await tag(second.id, false);
  const ask = (ids: readonly string[]) =>
    database.kysely
      .withPlugin(recorded.plugin)
      .transaction()
      .execute((transaction) =>
        askRules(
          transaction,
          createContext({ ...createTestContext(), rules }),
          "notes",
          "delete",
          ids.map((id) => ({ id })),
        ),
      );

  ran.length = 0;
  await expect(refusalOf(ask([first.id]))).resolves.toHaveLength(1);
  const forOne = ran.length;
  ran.length = 0;
  await expect(refusalOf(ask([first.id, second.id, loose.id]))).resolves.toEqual([
    referencedBy(first.id, [{ table: "note_links", count: 1 }]),
    referencedBy(second.id, [{ table: "note_tags", count: 2 }]),
  ]);
  // One lookup, one count per referring table, and the Refusal's own lookup of the rows (that
  // the write would find them), whatever the number of rows.
  expect(forOne).toBe(4);
  expect(ran.length).toBe(forOne);
});

test("a delete that succeeds takes no count, and every lookup uses an index", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  await link(note.id, { deleted_at: now });
  ran.length = 0;

  await client().delete({ id: note.id });

  const reads = ran.filter(({ sql }) => sql.startsWith("select"));
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.filter(({ sql }) => /count\(/i.test(sql))).toEqual([]);
  expect((await recorded.plans()).filter((detail) => /^SCAN|AUTOMATIC/.test(detail))).toEqual([]);
});

test("a refused delete counts through an index too", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  await link(note.id);
  await tag(note.id, false);
  ran.length = 0;

  await refusalOf(client().delete({ id: note.id }));

  expect(ran.filter(({ sql }) => /count\(/i.test(sql))).toHaveLength(2);
  expect((await recorded.plans()).filter((detail) => /^SCAN|AUTOMATIC/.test(detail))).toEqual([]);
});

/** The frame's writes on the tables of this test, in one transaction of their own. */
function folderWrites<Result>(
  write: (writes: ReturnType<typeof sharedWrites<Tables>>) => Promise<Result>,
  spaceId = FIRST_SPACE_ID,
) {
  return database.kysely
    .withPlugin(recorded.plugin)
    .transaction()
    .execute((transaction) =>
      write(
        sharedWrites(
          transaction.withTables<Tables>(),
          createContext({ ...createTestContext(), spaceId, rules }),
        ),
      ),
    );
}
async function folder(
  values: {
    parent_id?: string | null;
    deleted?: boolean;
    archived?: boolean;
    space_id?: string;
  } = {},
) {
  const { deleted, archived, ...rest } = values;
  const stored = {
    ...row(),
    parent_id: null,
    ...rest,
    deleted_at: deleted === true ? now : null,
    archived_at: archived === true ? now : null,
  };
  await db().insertInto("folders").values(stored).execute();
  return stored.id;
}
const nextId = () => row().id;
function targetDeleted(child: string, parent: string) {
  return {
    code: "target_deleted",
    severity: "blocking",
    table: "folders",
    row: child,
    field: "parent_id",
    details: { target: { table: "folders", id: parent } },
  };
}

test("a reference to an archived row is accepted on insert, update and restore", async () => {
  const archived = await folder({ archived: true });
  const child = nextId();

  await folderWrites((writes) => writes.insert("folders", child, { parent_id: archived }));
  await folderWrites((writes) => writes.update("folders", child, { parent_id: archived }));
  await folderWrites((writes) => writes.softDelete("folders", child));
  await expect(folderWrites((writes) => writes.restore("folders", child))).resolves.toMatchObject({
    id: child,
    parent_id: archived,
  });
});

test("a reference to a row of another Space is refused like a deleted one", async () => {
  const foreign = await folder({ space_id: SECOND_SPACE_ID });
  const child = nextId();

  await expect(
    refusalOf(folderWrites((writes) => writes.insert("folders", child, { parent_id: foreign }))),
  ).resolves.toEqual([targetDeleted(child, foreign)]);
  await expect(
    db().selectFrom("folders").select("id").where("id", "=", child).execute(),
  ).resolves.toEqual([]);
});

test("an update that writes no reference runs no query for the check; an empty reference asks nothing", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  const linked = nextId();
  await folderWrites((writes) =>
    writes.insert("note_links", linked, { note_id: note.id, label: "Before" }),
  );
  const parent = await folder();
  const child = await folder({ parent_id: parent });
  ran.length = 0;

  await folderWrites((writes) => writes.update("note_links", linked, { label: "After" }));
  await folderWrites((writes) => writes.update("folders", child, { parent_id: null }));
  await folderWrites((writes) => writes.insert("folders", nextId(), { parent_id: null }));

  // Only the writes themselves.
  expect(ran.map(({ sql }) => sql.split(" ")[0])).toEqual(["update", "update", "insert"]);
});

test("a row may refer to itself: the reference asks nothing, also on restore", async () => {
  const self = nextId();
  await folderWrites((writes) => writes.insert("folders", self, { parent_id: self }));
  await folderWrites((writes) => writes.softDelete("folders", self));

  await expect(folderWrites((writes) => writes.restore("folders", self))).resolves.toMatchObject({
    id: self,
  });
});

test("archive and unarchive succeed whatever the row refers to and whatever refers to it", async () => {
  const gone = await folder({ deleted: true });
  const middle = await folder({ parent_id: gone });
  await folder({ parent_id: middle });

  await expect(folderWrites((writes) => writes.archive("folders", middle))).resolves.toMatchObject({
    archived_at: now,
  });
  await expect(
    folderWrites((writes) => writes.unarchive("folders", middle)),
  ).resolves.toMatchObject({ archived_at: null });
});

test("handed several rows, the restore rule answers per row with one lookup of the rows and one of the targets, each by primary key", async () => {
  const live = await folder();
  const gone = await folder({ deleted: true });
  const fine = await folder({ parent_id: live, deleted: true });
  const blocked = await folder({ parent_id: gone, deleted: true });
  const orphan = await folder({ deleted: true });
  ran.length = 0;

  await expect(
    refusalOf(
      database.kysely
        .withPlugin(recorded.plugin)
        .transaction()
        .execute((transaction) =>
          askRules(
            transaction,
            createContext({ ...createTestContext(), rules }),
            "folders",
            "restore",
            [fine, blocked, orphan].map((id) => ({ id })),
          ),
        ),
    ),
  ).resolves.toEqual([targetDeleted(blocked, gone)]);
  // The rule's two lookups, then the Refusal's lookup that the restore would find its rows.
  expect(ran).toHaveLength(3);
  const plans = await recorded.plans();
  expect(plans).toHaveLength(3);
  for (const plan of plans)
    expect(plan).toMatch(/^SEARCH folders USING INDEX sqlite_autoindex_folders_1 \(id=\?\)$/);
});

test("an insert asks the target by primary key", async () => {
  const note = await client().create({ title: "Target", isPinned: false });
  ran.length = 0;

  await folderWrites((writes) => writes.insert("note_tags", nextId(), { note_id: note.id }));

  const plans = await recorded.plans();
  expect(plans.filter((detail) => /^SCAN|AUTOMATIC/.test(detail))).toEqual([]);
  expect(plans).toContain("SEARCH notes USING INDEX sqlite_autoindex_notes_1 (id=?)");
});
