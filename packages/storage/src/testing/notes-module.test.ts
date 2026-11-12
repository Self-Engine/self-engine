import type { Instant } from "@self-engine/time";
import { afterEach, beforeEach, expect, expectTypeOf, test } from "vite-plus/test";
import {
  noteIdSchema,
  notesMigrations,
  notesRowMap,
  noteSchema,
  toNote,
  type NoteId,
  type NoteRow,
} from "../../test/notes-module/data/rows.ts";
import {
  createMigrationRunner,
  newId,
  newTimestamp,
  type TablesOf,
  type Database,
} from "@self-engine/db";
import { checkAgreement, checkConventions, createTestSources } from "@self-engine/db/testing";
import { openDatabase } from "@self-engine/db/better-sqlite3";

let database: Database;

beforeEach(async () => {
  database = openDatabase(":memory:");
  await createMigrationRunner(database, notesMigrations).run();
});

afterEach(async () => {
  await database.close();
});

test("the notes module follows conventions and its row map agrees with its migrations", async () => {
  await expect(checkConventions(database)).resolves.toEqual([]);
  await expect(checkAgreement(notesMigrations, notesRowMap)).resolves.toEqual([]);
});

test.each<{ isPinned: 0 | 1; expected: boolean }>([
  { isPinned: 0, expected: false },
  { isPinned: 1, expected: true },
])(
  "round-trips a note with stored boolean $isPinned and branded types",
  async ({ isPinned, expected }) => {
    const sources = createTestSources(new Date("2026-11-12T12:00:00.000Z"));
    const createdAt = newTimestamp(sources.clock);
    sources.advance(1000);
    const updatedAt = newTimestamp(sources.clock);
    const row: NoteRow = {
      id: newId<NoteId>(sources.ids),
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: null,
      space_id: newId<NoteRow["space_id"]>(sources.ids),
      title: "A typed note",
      is_pinned: isPinned,
    };
    const queries = database.kysely.withTables<TablesOf<typeof notesRowMap>>();
    await queries.insertInto("notes").values(row).execute();
    const stored = await queries
      .selectFrom("notes")
      .selectAll()
      .where("space_id", "=", row.space_id)
      .where("deleted_at", "is", null)
      .where("id", "=", row.id)
      .executeTakeFirst();
    if (stored === undefined) throw new Error("Expected the inserted note");
    expectTypeOf(stored.id).toEqualTypeOf<NoteId>();
    expectTypeOf(stored.created_at).toEqualTypeOf<Instant>();
    expectTypeOf(stored.updated_at).toEqualTypeOf<Instant>();
    const note = toNote(stored);
    expectTypeOf(note.id).toEqualTypeOf<NoteId>();
    expectTypeOf(note.createdAt).toEqualTypeOf<Instant>();
    expectTypeOf(note.updatedAt).toEqualTypeOf<Instant>();
    expect(note).toEqual({
      id: row.id,
      title: "A typed note",
      isPinned: expected,
      createdAt: "2026-11-12T12:00:00.000Z",
      updatedAt: "2026-11-12T12:00:01.000Z",
    });
    expect(noteSchema.parse(note)).toEqual(note);
  },
);

test("live titles are unique within a space and become reusable after soft deletion", async () => {
  const sources = createTestSources(new Date("2026-11-12T12:00:00.000Z"));
  const now = newTimestamp(sources.clock);
  const row: NoteRow = {
    id: newId<NoteId>(sources.ids),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    space_id: newId<NoteRow["space_id"]>(sources.ids),
    title: "Reusable title",
    is_pinned: 0,
  };
  const queries = database.kysely.withTables<TablesOf<typeof notesRowMap>>();
  await queries.insertInto("notes").values(row).execute();
  const replacement = { ...row, id: newId<NoteId>(sources.ids) };
  await expect(queries.insertInto("notes").values(replacement).execute()).rejects.toThrow(
    /UNIQUE constraint failed: notes.space_id, notes.title/,
  );
  // The same title in another space never conflicts.
  await queries
    .insertInto("notes")
    .values({
      ...row,
      id: newId<NoteId>(sources.ids),
      space_id: newId<NoteRow["space_id"]>(sources.ids),
    })
    .execute();
  sources.advance(1000);
  const deletedAt = newTimestamp(sources.clock);
  await queries
    .updateTable("notes")
    .set({ deleted_at: deletedAt, updated_at: deletedAt })
    .where("space_id", "=", row.space_id)
    .where("deleted_at", "is", null)
    .where("id", "=", row.id)
    .execute();
  await queries.insertInto("notes").values(replacement).execute();
  const live = await queries
    .selectFrom("notes")
    .selectAll()
    .where("space_id", "=", row.space_id)
    .where("deleted_at", "is", null)
    .execute();
  expect(live.map(toNote)).toEqual([toNote(replacement)]);
  const original = await queries
    .selectFrom("notes")
    .select("deleted_at")
    .where("id", "=", row.id)
    .executeTakeFirst();
  expect(original).toEqual({ deleted_at: "2026-11-12T12:00:01.000Z" });
});

test("notes passes the storage contract kit", async () => {
  const { notes } = await import("../../test/notes-module/data/index.ts");
  const { checkContract } = await import("./index.ts");
  await expect(
    checkContract(
      notes,
      async (tx, context) => {
        await notes.entries.create.run(tx, context, { title: "Seed note", isPinned: false });
        const removed = await notes.entries.create.run(tx, context, {
          title: "Deleted note",
          isPinned: false,
        });
        await notes.entries.delete.run(tx, context, { id: noteIdSchema.parse(removed.id) });
      },
      {
        create: { title: "New note", isPinned: true },
        list: {},
        get: { id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000") },
        update: {
          id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000"),
          title: "Updated note",
        },
        delete: { id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000") },
        restore: { id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000001") },
      },
      {
        create: [{ input: { title: "Seed note", isPinned: false } }],
        update: [
          {
            input: {
              id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000"),
              title: "Taken",
            },
            prepare: async (tx, context) => {
              await notes.entries.create.run(tx, context, { title: "Taken", isPinned: false });
            },
          },
        ],
        restore: [
          {
            input: { id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000001") },
            prepare: async (tx, context) => {
              await notes.entries.create.run(tx, context, {
                title: "Deleted note",
                isPinned: false,
              });
            },
          },
        ],
      },
    ),
  ).resolves.toEqual([]);
});
