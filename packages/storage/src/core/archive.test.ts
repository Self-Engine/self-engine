import { createRouterClient } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { createSpaceRows, SECOND_SPACE_ID } from "@self-engine/spaces/testing";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { cards } from "../../test/cards-module/data/index.ts";
import { cardIdSchema } from "../../test/cards-module/contracts/index.ts";
import { cardsMigrations, cardsRowMap } from "../../test/cards-module/data/rows.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";
import { createContext, createFrame, sharedWrites } from "./index.ts";

type Database = Awaited<ReturnType<typeof createTestDatabase>>;
let database: Database;
let sources: ReturnType<typeof createTestContext>;
let announced: string[][];

function client() {
  return createRouterClient(
    createFrame(cards, {
      database,
      sources,
      checkOutputs: true,
      announce: (tables) => {
        announced.push([...tables]);
      },
    }),
  );
}

beforeEach(async () => {
  database = await createTestDatabase(cards);
  sources = createTestContext();
  announced = [];
});

afterEach(async () => {
  await database.close();
});

test("an archivable table follows the conventions and agrees with its row map", async () => {
  await expect(checkConventions(database)).resolves.toEqual([]);
  await expect(checkAgreement(cardsMigrations, cardsRowMap)).resolves.toEqual([]);
});

test("archiving a Live Row sets the Clock's Instant, advances updated_at and names the table", async () => {
  const card = await client().create({ title: "Website" });
  expect(card.archivedAt).toBeNull();
  sources.advance(1000);
  announced = [];

  const archived = await client().archive({ id: card.id });

  expect(archived).toEqual({
    ...card,
    archivedAt: "2026-11-12T12:00:01.000Z",
    updatedAt: "2026-11-12T12:00:01.000Z",
  });
  expect(announced).toEqual([["cards"]]);
  await expect(client().get({ id: card.id })).resolves.toEqual(archived);
});

test("archiving an archived row keeps the first Instant and writes nothing", async () => {
  const card = await client().create({ title: "Website" });
  sources.advance(1000);
  const archived = await client().archive({ id: card.id });
  sources.advance(1000);
  announced = [];

  await expect(client().archive({ id: card.id })).resolves.toEqual(archived);
  expect(announced).toEqual([]);
});

test("unarchiving an archived row empties archived_at and advances updated_at", async () => {
  const card = await client().create({ title: "Website" });
  sources.advance(1000);
  await client().archive({ id: card.id });
  sources.advance(1000);
  announced = [];

  await expect(client().unarchive({ id: card.id })).resolves.toEqual({
    ...card,
    archivedAt: null,
    updatedAt: "2026-11-12T12:00:02.000Z",
  });
  expect(announced).toEqual([["cards"]]);
});

test("unarchiving a row that is not archived answers with it and writes nothing", async () => {
  const card = await client().create({ title: "Website" });
  sources.advance(1000);
  announced = [];

  await expect(client().unarchive({ id: card.id })).resolves.toEqual(card);
  expect(announced).toEqual([]);
});

test.each(["archive", "unarchive"] as const)(
  "%s answers NOT_FOUND for an unknown or a deleted row",
  async (entry) => {
    const card = await client().create({ title: "Gone" });
    await client().delete({ id: card.id });
    announced = [];
    for (const id of [card.id, cardIdSchema.parse("00000000-0000-7000-8000-000000000099")])
      await expect(client()[entry]({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(announced).toEqual([]);
  },
);

test.each(["archive", "unarchive"] as const)(
  "%s never touches a row of another Space",
  async (entry) => {
    await createSpaceRows(database.kysely, [{ id: SECOND_SPACE_ID }]);
    const context = { ...createContext(sources), spaceId: SECOND_SPACE_ID };
    const id = context.newId(cardIdSchema);
    await database.kysely.transaction().execute(async (transaction) => {
      const writes = sharedWrites(transaction.withTables<TablesOf<typeof cardsRowMap>>(), context);
      await writes.insert("cards", id, { title: "Foreign" });
      if (entry === "unarchive") await writes.archive("cards", id);
    });
    const rows = () =>
      database.kysely
        .withTables<TablesOf<typeof cardsRowMap>>()
        .selectFrom("cards")
        .selectAll()
        .execute();
    const before = await rows();

    await expect(client()[entry]({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(rows()).resolves.toEqual(before);
  },
);

test("deleting an archived row and restoring it brings it back archived", async () => {
  const card = await client().create({ title: "Tax 2024" });
  sources.advance(1000);
  const archived = await client().archive({ id: card.id });
  sources.advance(1000);
  await client().delete({ id: card.id });
  sources.advance(1000);

  await expect(client().restore({ id: card.id })).resolves.toEqual({
    ...archived,
    updatedAt: "2026-11-12T12:00:03.000Z",
  });
});

test("the active filter leaves out archived and deleted rows; the live filter keeps archived ones", async () => {
  const open = await client().create({ title: "Open" });
  const shelved = await client().archive({ id: (await client().create({ title: "Shelved" })).id });
  await client().delete({ id: (await client().create({ title: "Deleted" })).id });
  const deletedArchived = await client().create({ title: "Deleted archived" });
  await client().archive({ id: deletedArchived.id });
  await client().delete({ id: deletedArchived.id });

  await expect(client().active({})).resolves.toEqual([open]);
  await expect(client().all({})).resolves.toEqual([open, shelved]);
});

test("insert and update leave archived_at to the two write paths", async () => {
  const context = createContext(sources);
  const id = context.newId(cardIdSchema);
  await database.kysely.transaction().execute(async (transaction) => {
    const writes = sharedWrites(transaction.withTables<TablesOf<typeof cardsRowMap>>(), context);
    const injected = { title: "Safe", archived_at: context.now };
    // @ts-expect-error archived_at is a convention column.
    expect(await writes.insert("cards", id, injected)).toMatchObject({ archived_at: null });
    // @ts-expect-error archived_at is a convention column.
    expect(await writes.update("cards", id, injected)).toMatchObject({ archived_at: null });
  });
});

test("the archive paths accept only a table that has archived_at", async () => {
  const { notes } = await import("../../test/notes-module/data/index.ts");
  const { sharedEntry } = await import("./index.ts");
  const notesDatabase = await createTestDatabase(notes);
  try {
    await notesDatabase.kysely.transaction().execute(async (transaction) => {
      const tx = transaction.withTables<TablesOf<typeof notes.rowMap>>();
      const context = createContext(sources);
      const id = context.newId(cardIdSchema) as unknown as never;
      const reads = sharedEntry(tx, context);
      // @ts-expect-error notes has no archive column.
      const query = reads.active("notes");
      await expect(query.selectAll().execute()).rejects.toThrow(/archived_at/);
      const writes = sharedWrites(tx, context);
      // @ts-expect-error notes has no archive column.
      const archiving = writes.archive("notes", id);
      await expect(archiving).rejects.toThrow(/archived_at/);
    });
  } finally {
    await notesDatabase.close();
  }
});
