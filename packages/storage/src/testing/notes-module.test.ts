import type { Instant } from "@self-engine/time";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from "vite-plus/test";
import {
  noteIdSchema,
  notesMigrations,
  notesRowMap,
  noteSchema,
  toNote,
  type NoteId,
  type NoteRow,
} from "../../test/notes-module/data/rows.ts";
import { newId, type TablesOf, type Database } from "@self-engine/db";
import { checkAgreement, checkConventions, createTestSources } from "@self-engine/db/testing";
import {
  createSpaceRows,
  FIRST_SPACE_ID,
  SECOND_SPACE_ID,
  THIRD_SPACE_ID,
} from "@self-engine/spaces/testing";
import { createTestDatabase } from "./helpers.ts";

let database: Database;

beforeEach(async () => {
  database = await createTestDatabase({ migrations: notesMigrations });
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
    const sources = createTestSources("2026-11-12T12:00:00.000Z");
    const createdAt = sources.clock();
    sources.advance(1000);
    const updatedAt = sources.clock();
    const row: NoteRow = {
      id: newId<NoteId>(sources.ids),
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: null,
      space_id: FIRST_SPACE_ID,
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
  const sources = createTestSources("2026-11-12T12:00:00.000Z");
  const now = sources.clock();
  const row: NoteRow = {
    id: newId<NoteId>(sources.ids),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    space_id: FIRST_SPACE_ID,
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
  await createSpaceRows(database.kysely, [{ id: SECOND_SPACE_ID }]);
  await queries
    .insertInto("notes")
    .values({
      ...row,
      id: newId<NoteId>(sources.ids),
      space_id: SECOND_SPACE_ID,
    })
    .execute();
  sources.advance(1000);
  const deletedAt = sources.clock();
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

describe("the foreign key to spaces (D286)", () => {
  function noteIn(spaceId: NoteRow["space_id"]): NoteRow {
    const sources = createTestSources("2026-11-12T12:00:00.000Z");
    const now = sources.clock();
    return {
      id: newId<NoteId>(sources.ids),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      space_id: spaceId,
      title: "Somewhere",
      is_pinned: 0,
    };
  }

  test("fails a transaction that writes a row whose Space the database does not hold, at its end", async () => {
    const queries = database.kysely.withTables<TablesOf<typeof notesRowMap>>();
    let written = false;

    await expect(
      queries.transaction().execute(async (tx) => {
        await tx.insertInto("notes").values(noteIn(THIRD_SPACE_ID)).execute();
        // The key is deferred: the statement passes, the commit does not.
        written = true;
      }),
    ).rejects.toThrow("FOREIGN KEY constraint failed");
    expect(written).toBe(true);
    await expect(queries.selectFrom("notes").selectAll().execute()).resolves.toEqual([]);
  });

  test("lets a transaction write the Space after the row that refers to it", async () => {
    const queries = database.kysely.withTables<TablesOf<typeof notesRowMap>>();
    const note = noteIn(THIRD_SPACE_ID);

    await database.kysely.transaction().execute(async (transaction) => {
      await transaction
        .withTables<TablesOf<typeof notesRowMap>>()
        .insertInto("notes")
        .values(note)
        .execute();
      await createSpaceRows(transaction, [{ id: THIRD_SPACE_ID }]);
    });

    await expect(queries.selectFrom("notes").selectAll().execute()).resolves.toEqual([note]);
  });
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
        pages: {},
        window: { from: "2026-11-12T00:00:00.000Z", to: "2026-11-13T00:00:00.000Z" },
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

test("the notes lists take their input types from the Contract", async () => {
  const { notes } = await import("../../test/notes-module/data/index.ts");
  expectTypeOf<Parameters<typeof notes.entries.window.run>[2]>().toEqualTypeOf<{
    from: Instant;
    to: Instant;
  }>();
  expectTypeOf<Parameters<typeof notes.entries.list.run>[2]>().toEqualTypeOf<
    Record<string, never>
  >();
  expectTypeOf<Parameters<typeof notes.entries.pages.run>[2]>().toEqualTypeOf<{
    cursor?: string | undefined;
  }>();
  expectTypeOf<Parameters<typeof notes.entries.window.run>[0]>().toEqualTypeOf<
    Parameters<typeof notes.entries.get.run>[0]
  >();
});
