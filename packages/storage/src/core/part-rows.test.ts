import { createRouterClient } from "@orpc/server";
import { referencesOf, type Database } from "@self-engine/db";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { baskets } from "../../test/baskets-module/data/index.ts";
import { notes } from "../../test/notes-module/data/index.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";
import { recordStatements } from "../testing/statements.ts";
import { tableContents } from "../testing/table-contents.ts";
import {
  clearance,
  createContext,
  createFrame,
  partRows,
  protectionRules,
  referenceCheck,
} from "./index.ts";

let database: Database;
let sources: ReturnType<typeof createTestContext> & {
  rules: ReturnType<typeof protectionRules>;
  parts: ReturnType<typeof partRows>;
};
let notesCalls: ReturnType<typeof notesClient>;
let basketsCalls: ReturnType<typeof basketsClient>;

beforeEach(async () => {
  database = await createTestDatabase(baskets, [notes]);
  const references = await referencesOf(database);
  const parts = partRows([notes, baskets], references);
  sources = {
    ...createTestContext(),
    rules: protectionRules([referenceCheck(references, parts)]),
    parts,
  };
  notesCalls = notesClient();
  basketsCalls = basketsClient();
});
afterEach(async () => {
  await database.close();
});

function notesClient() {
  return createRouterClient(createFrame(notes, { database, sources, checkOutputs: true }));
}
function basketsClient() {
  return createRouterClient(createFrame(baskets, { database, sources, checkOutputs: true }));
}

async function refusalOf(write: Promise<unknown>) {
  const error: unknown = await write.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toMatchObject({ code: "REFUSED" });
  return (error as { data: { reasons: unknown[] } }).data.reasons;
}

/** A basket with one item for each note. */
async function basketWith(...noteIds: string[]) {
  const basket = await basketsCalls.create({ title: "Basket" });
  const items = [];
  for (const noteId of noteIds)
    items.push(await basketsCalls.addItem({ basketId: basket.id, noteId: noteId as never }));
  return { basket, items };
}
const note = (title = "Note") => notesCalls.create({ title, isPinned: false });

function targetDeleted(basketId: string, noteId: string) {
  return {
    code: "target_deleted",
    severity: "blocking",
    table: "baskets",
    row: basketId,
    field: "basket_items",
    details: { target: { table: "notes", id: noteId } },
  };
}

describe("an owner", () => {
  test("is deleted although its Part Rows refer to it, and they stay untouched", async () => {
    const target = await note();
    const { basket } = await basketWith(target.id, target.id);
    const before = (await tableContents(database)).get("basket_items");

    await expect(basketsCalls.delete({ id: basket.id })).resolves.toMatchObject({ id: basket.id });

    expect((await tableContents(database)).get("basket_items")).toEqual(before);
  });

  test("of another module is deleted although Part Rows of this one belong to it", async () => {
    const target = await note();
    await basketsCalls.mark({ noteId: target.id, label: "Mark" });

    await expect(notesCalls.delete({ id: target.id })).resolves.toMatchObject({ id: target.id });
  });

  test("is restored with its live Part Rows", async () => {
    const target = await note();
    const { basket, items } = await basketWith(target.id);
    await basketsCalls.delete({ id: basket.id });

    await basketsCalls.restore({ id: basket.id });

    await expect(basketsCalls.get({ id: basket.id })).resolves.toMatchObject({ items });
  });

  test("is not restored while one of its live Part Rows refers to a deleted row; a removed one does not count", async () => {
    const [kept, removed] = [await note("Kept"), await note("Removed")];
    const { basket, items } = await basketWith(kept.id, kept.id, removed.id);
    await basketsCalls.removeItem({ id: items[2]!.id });
    await basketsCalls.delete({ id: basket.id });
    await notesCalls.delete({ id: removed.id });
    await notesCalls.delete({ id: kept.id });

    // Two items refer to the same deleted note: one Reason for it.
    await expect(refusalOf(basketsCalls.restore({ id: basket.id }))).resolves.toEqual([
      targetDeleted(basket.id, kept.id),
    ]);
    await notesCalls.restore({ id: kept.id });
    await expect(basketsCalls.restore({ id: basket.id })).resolves.toMatchObject({
      id: basket.id,
    });
  });
});

describe("a row that Part Rows refer to", () => {
  test("is refused while their owner is live, with the owners counted under the owner's table", async () => {
    const target = await note();
    await basketWith(target.id, target.id);
    await basketWith(target.id);

    await expect(refusalOf(notesCalls.delete({ id: target.id }))).resolves.toEqual([
      {
        code: "referenced",
        severity: "blocking",
        table: "notes",
        row: target.id,
        details: { tables: [{ table: "baskets", count: 2 }] },
      },
    ]);
  });

  test("is deleted once their owner is: a Part Row of a deleted owner protects nothing", async () => {
    const target = await note();
    const { basket } = await basketWith(target.id);
    await basketsCalls.delete({ id: basket.id });

    await expect(notesCalls.delete({ id: target.id })).resolves.toMatchObject({ id: target.id });
  });
});

describe("a Part Row", () => {
  test("of a deleted owner is not found for every write, and absent from reads", async () => {
    const [target, other] = [await note(), await note("Other")];
    const { basket, items } = await basketWith(target.id, target.id);
    await basketsCalls.removeItem({ id: items[1]!.id });
    await basketsCalls.delete({ id: basket.id });
    const before = await tableContents(database);

    for (const write of [
      basketsCalls.moveItem({ id: items[0]!.id, noteId: other.id }),
      basketsCalls.removeItem({ id: items[0]!.id }),
      basketsCalls.restoreItem({ id: items[1]!.id }),
    ])
      await expect(write).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await tableContents(database)).toEqual(before);
  });

  test("of another module's deleted row is left out of the live rows and back with it", async () => {
    const target = await note();
    const mark = await basketsCalls.mark({ noteId: target.id, label: "Mark" });
    await notesCalls.delete({ id: target.id });

    await expect(basketsCalls.marks({})).resolves.toEqual([]);
    await notesCalls.restore({ id: target.id });
    await expect(basketsCalls.marks({})).resolves.toEqual([mark]);
  });

  test("is removed from its owner by a soft delete and comes back with a restore", async () => {
    const target = await note();
    const { basket, items } = await basketWith(target.id);

    await basketsCalls.removeItem({ id: items[0]!.id });
    await expect(basketsCalls.get({ id: basket.id })).resolves.toMatchObject({ items: [] });
    await expect(notesCalls.delete({ id: target.id })).resolves.toMatchObject({ id: target.id });
    await notesCalls.restore({ id: target.id });
    await basketsCalls.restoreItem({ id: items[0]!.id });
    await expect(basketsCalls.get({ id: basket.id })).resolves.toMatchObject({ items });
  });

  test("is not added to a deleted owner", async () => {
    const target = await note();
    const { basket } = await basketWith();
    await basketsCalls.delete({ id: basket.id });

    await expect(
      refusalOf(basketsCalls.addItem({ basketId: basket.id, noteId: target.id })),
    ).resolves.toMatchObject([{ code: "target_deleted", field: "basket_id" }]);
  });
});

describe("a row that names no owner", () => {
  test("is an ordinary row, live by itself: read, written and removed as any row", async () => {
    const [target, other] = [await note(), await note("Other")];
    const loose = await basketsCalls.addItem({ basketId: null, noteId: target.id });
    const mark = await basketsCalls.mark({ noteId: null, label: "Loose" });

    await expect(basketsCalls.marks({})).resolves.toEqual([mark]);
    await expect(basketsCalls.moveItem({ id: loose.id, noteId: other.id })).resolves.toEqual({
      ...loose,
      noteId: other.id,
    });
    await basketsCalls.removeItem({ id: loose.id });
    await expect(basketsCalls.restoreItem({ id: loose.id })).resolves.toMatchObject({
      id: loose.id,
    });
  });

  test("protects what it refers to, counted under its own table beside the owners", async () => {
    const target = await note();
    await basketWith(target.id);
    await basketsCalls.addItem({ basketId: null, noteId: target.id });
    await basketsCalls.addItem({ basketId: null, noteId: target.id });

    await expect(refusalOf(notesCalls.delete({ id: target.id }))).resolves.toEqual([
      {
        code: "referenced",
        severity: "blocking",
        table: "notes",
        row: target.id,
        details: {
          tables: [
            { table: "baskets", count: 1 },
            { table: "basket_items", count: 2 },
          ],
        },
      },
    ]);
  });

  test("is not restored while it refers to a deleted row", async () => {
    const target = await note();
    const loose = await basketsCalls.addItem({ basketId: null, noteId: target.id });
    await basketsCalls.removeItem({ id: loose.id });
    await notesCalls.delete({ id: target.id });

    await expect(refusalOf(basketsCalls.restoreItem({ id: loose.id }))).resolves.toMatchObject([
      { code: "target_deleted", row: loose.id, field: "note_id" },
    ]);
  });
});

test("the Clearance gives the same answers without writing", async () => {
  const [protectedNote, freeNote] = [await note("Protected"), await note("Free")];
  const { basket: live } = await basketWith(protectedNote.id);
  const { basket: gone, items } = await basketWith(freeNote.id);
  await basketsCalls.delete({ id: gone.id });
  await notesCalls.delete({ id: freeNote.id });
  const before = await tableContents(database);

  const ask = (table: string, writes: ("delete" | "restore" | "update")[], ids: string[]) =>
    database.kysely
      .transaction()
      .execute((tx) => clearance(tx, createContext(sources), table, writes, ids));

  await expect(ask("notes", ["delete"], [protectedNote.id])).resolves.toEqual([
    {
      row: protectedNote.id,
      writes: {
        delete: {
          state: "blocked",
          reasons: [
            expect.objectContaining({ details: { tables: [{ table: "baskets", count: 1 }] } }),
          ],
        },
      },
    },
  ]);
  await expect(ask("baskets", ["delete", "restore"], [live.id, gone.id])).resolves.toEqual([
    { row: live.id, writes: { delete: { state: "free" }, restore: { state: "notFound" } } },
    {
      row: gone.id,
      writes: {
        delete: { state: "notFound" },
        restore: { state: "blocked", reasons: [targetDeleted(gone.id, freeNote.id)] },
      },
    },
  ]);
  await expect(ask("basket_items", ["update", "delete"], [items[0]!.id])).resolves.toEqual([
    { row: items[0]!.id, writes: { update: { state: "notFound" }, delete: { state: "notFound" } } },
  ]);
  expect(await tableContents(database)).toEqual(before);
});

describe("the start", () => {
  test("refuses an owner reference the schema does not hold", async () => {
    const references = await referencesOf(database);
    expect(() => partRows([{ belongsTo: { note_marks: "label" } }], references)).toThrow(
      /note_marks\.label .*no reference/,
    );
    expect(() => partRows([{ belongsTo: { lost: "note_id" } }], references)).toThrow(
      /lost\.note_id .*no reference/,
    );
  });

  test("refuses a reference to a Part Row, and so an owner that is a Part Row itself", async () => {
    const references = [
      ...(await referencesOf(database)),
      { table: "notes", column: "mark_id", target: "note_marks" },
    ];
    expect(() => partRows([baskets], references)).toThrow(
      /note_marks holds Part Rows.*notes\.mark_id/,
    );
  });
});

test("every lookup of the check and of the shared reads uses an index", async () => {
  const target = await note();
  const { basket } = await basketWith(target.id);
  await basketsCalls.mark({ noteId: target.id, label: "Mark" });
  const recorded = recordStatements(database);
  const framed = { ...database, kysely: database.kysely.withPlugin(recorded.plugin) };
  const recordedNotes = createRouterClient(
    createFrame(notes, { database: framed, sources, checkOutputs: true }),
  );
  const recordedBaskets = createRouterClient(
    createFrame(baskets, { database: framed, sources, checkOutputs: true }),
  );

  await refusalOf(recordedNotes.delete({ id: target.id }));
  await recordedBaskets.get({ id: basket.id });
  await recordedBaskets.marks({});
  await recordedBaskets.delete({ id: basket.id });
  await recordedNotes.delete({ id: target.id });
  await refusalOf(recordedBaskets.restore({ id: basket.id }));

  expect(recorded.statements.length).toBeGreaterThan(0);
  expect((await recorded.plans()).filter((detail) => /^SCAN|AUTOMATIC/.test(detail))).toEqual([]);
});
