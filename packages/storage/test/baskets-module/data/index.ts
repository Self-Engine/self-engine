import {
  defineStorageModule,
  sharedEntry,
  sharedWrites,
  smallSetList,
} from "../../../src/core/index.ts";
import {
  basketIdSchema,
  basketItemIdSchema,
  basketsContract,
  noteMarkIdSchema,
} from "../contracts/index.ts";
import { basketsMigrations, basketsRowMap, toBasket, toItem, toMark } from "./rows.ts";

export const baskets = defineStorageModule({
  name: "baskets",
  contract: basketsContract,
  migrations: basketsMigrations,
  rowMap: basketsRowMap,
  // An item is live only while its basket is, a mark only while its note is (ADR 0042).
  belongsTo: { basket_items: "basket_id", note_marks: "note_id" },
}).entries({
  create: {
    kind: "operation",
    async run(tx, context, input) {
      return toBasket(
        await sharedWrites(tx, context).insert("baskets", context.newId(basketIdSchema), {
          title: input.title,
        }),
      );
    },
  },
  get: {
    kind: "query",
    reads: ["baskets", "basket_items"],
    async run(tx, context, input) {
      const reads = sharedEntry(tx, context);
      const basket = await reads.lookup("baskets", input.id);
      const items = await reads
        .live("basket_items")
        .selectAll("basket_items")
        .where("basket_items.basket_id", "=", input.id)
        .orderBy("basket_items.id")
        .execute();
      return { ...toBasket(basket), items: items.map(toItem) };
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toBasket(await sharedWrites(tx, context).softDelete("baskets", input.id));
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toBasket(await sharedWrites(tx, context).restore("baskets", input.id));
    },
  },
  addItem: {
    kind: "operation",
    async run(tx, context, input) {
      return toItem(
        await sharedWrites(tx, context).insert("basket_items", context.newId(basketItemIdSchema), {
          basket_id: input.basketId,
          note_id: input.noteId,
        }),
      );
    },
  },
  moveItem: {
    kind: "operation",
    async run(tx, context, input) {
      return toItem(
        await sharedWrites(tx, context).update("basket_items", input.id, { note_id: input.noteId }),
      );
    },
  },
  removeItem: {
    kind: "operation",
    async run(tx, context, input) {
      return toItem(await sharedWrites(tx, context).softDelete("basket_items", input.id));
    },
  },
  restoreItem: {
    kind: "operation",
    async run(tx, context, input) {
      return toItem(await sharedWrites(tx, context).restore("basket_items", input.id));
    },
  },
  mark: {
    kind: "operation",
    async run(tx, context, input) {
      return toMark(
        await sharedWrites(tx, context).insert("note_marks", context.newId(noteMarkIdSchema), {
          note_id: input.noteId,
          label: input.label,
        }),
      );
    },
  },
  // The frame leaves out a mark whose note is deleted, so the Query reads `notes` too.
  marks: smallSetList(["note_marks", "notes"], async (tx, context) =>
    (
      await sharedEntry(tx, context)
        .live("note_marks")
        .selectAll("note_marks")
        .orderBy("note_marks.id")
        .execute()
    ).map(toMark),
  ),
});
