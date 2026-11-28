import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { expect, test } from "vite-plus/test";
import { basketIdSchema, basketItemIdSchema } from "../../test/baskets-module/contracts/index.ts";
import { baskets } from "../../test/baskets-module/data/index.ts";
import { basketsMigrations, basketsRowMap } from "../../test/baskets-module/data/rows.ts";
import { noteIdSchema } from "../../test/notes-module/contracts/index.ts";
import { notes } from "../../test/notes-module/data/index.ts";
import { notesRowMap } from "../../test/notes-module/data/rows.ts";
import { sharedEntry, smallSetList, type StorageContext } from "../core/index.ts";
import { checkContract, createTestDatabase, type Seed } from "./index.ts";

// The ids the seed's counted id source hands out, in the order it asks for them.
const [liveNote, deletedNote, liveBasket, item, removedItem, mark, deletedBasket, itemOfDeleted] = [
  0, 1, 2, 3, 4, 5, 6, 7,
].map((index) => `01a1cfa1-0a00-7000-8000-${String(index).padStart(12, "0")}`);

/**
 * A live basket with an item and one removed from it, a marked note, a deleted basket with an
 * item, and a loose item and a mark that name no owner: ordinary rows, live by themselves.
 */
const seed: Seed<typeof basketsRowMap> = async (tx, context) => {
  const withNotes = tx as never;
  const note = await notes.entries.create.run(withNotes, context, {
    title: "Seed",
    isPinned: false,
  });
  const removed = await notes.entries.create.run(withNotes, context, {
    title: "Removed",
    isPinned: false,
  });
  await notes.entries.delete.run(withNotes, context, { id: noteIdSchema.parse(removed.id) });
  const basket = await baskets.entries.create.run(tx, context, { title: "Live" });
  await baskets.entries.addItem.run(tx, context, { basketId: basket.id, noteId: note.id });
  const removedItem = await baskets.entries.addItem.run(tx, context, {
    basketId: basket.id,
    noteId: note.id,
  });
  await baskets.entries.removeItem.run(tx, context, { id: removedItem.id });
  await baskets.entries.mark.run(tx, context, { noteId: note.id, label: "Mark" });
  const gone = await baskets.entries.create.run(tx, context, { title: "Deleted" });
  await baskets.entries.addItem.run(tx, context, { basketId: gone.id, noteId: note.id });
  await baskets.entries.delete.run(tx, context, { id: gone.id });
  await baskets.entries.addItem.run(tx, context, { basketId: null, noteId: note.id });
  await baskets.entries.mark.run(tx, context, { noteId: null, label: "Loose" });
};

const examples = {
  create: { title: "New" },
  get: { id: basketIdSchema.parse(liveBasket) },
  delete: { id: basketIdSchema.parse(liveBasket) },
  restore: { id: basketIdSchema.parse(deletedBasket) },
  addItem: { basketId: basketIdSchema.parse(liveBasket), noteId: noteIdSchema.parse(liveNote) },
  moveItem: { id: basketItemIdSchema.parse(item), noteId: noteIdSchema.parse(liveNote) },
  removeItem: { id: basketItemIdSchema.parse(item) },
  restoreItem: { id: basketItemIdSchema.parse(removedItem) },
  mark: { noteId: noteIdSchema.parse(liveNote), label: "Another" },
  marks: {},
};

test("the baskets module follows the conventions and its row map agrees with its migrations", async () => {
  const database = await createTestDatabase(baskets, [notes]);
  try {
    await expect(checkConventions(database)).resolves.toEqual([]);
  } finally {
    await database.close();
  }
  await expect(checkAgreement(basketsMigrations, basketsRowMap)).resolves.toEqual([]);
  void notesRowMap;
});

test("a module with an owner and Part Rows passes the contract kit", async () => {
  void [deletedNote, mark, itemOfDeleted];
  await expect(checkContract(baskets, seed, examples, {}, [notes])).resolves.toEqual([]);
});

test("the kit fails a Query that reads Part Rows of a deleted owner", async () => {
  const careless = {
    ...baskets,
    entries: {
      ...baskets.entries,
      // Reads the marks without the frame's shared read, so a mark of a deleted note stays.
      marks: smallSetList(["note_marks", "notes"], async (tx, context: StorageContext) => {
        void sharedEntry;
        const rows = await tx
          .selectFrom("note_marks")
          .selectAll()
          .where("space_id", "=", context.spaceId)
          .where("deleted_at", "is", null)
          .orderBy("id")
          .execute();
        return rows.map((row) => ({ id: row.id, noteId: row.note_id, label: row.label }));
      }),
    },
  } as typeof baskets;

  await expect(checkContract(careless, seed, examples, {}, [notes])).resolves.toEqual([
    { entry: "marks", rule: "entry does not treat Part Rows of a deleted owner as absent" },
  ]);
});

test("the kit fails an owner reference the schema does not hold, and a seed without a Part Row of an owner", async () => {
  const broken = { ...baskets, belongsTo: { note_marks: "label" } } as unknown as typeof baskets;
  await expect(checkContract(broken, seed, examples, {}, [notes])).resolves.toEqual([
    {
      entry: "belongsTo",
      rule: "note_marks.label is named as the owner of a Part Row, but the schema holds no reference there",
    },
  ]);

  const empty: Seed<typeof basketsRowMap> = async () => {};
  // A row that names no owner is no Part Row.
  const loose: Seed<typeof basketsRowMap> = async (tx, context) => {
    await baskets.entries.mark.run(tx, context, { noteId: null, label: "Loose" });
  };
  for (const without of [empty, loose])
    await expect(checkContract(baskets, without, examples, {}, [notes])).resolves.toContainEqual({
      entry: "belongsTo",
      rule: "seed has no Part Row of a live owner",
    });
});
