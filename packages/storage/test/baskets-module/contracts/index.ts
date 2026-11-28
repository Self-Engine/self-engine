import { oc } from "@orpc/contract";
import { idSchema, refusal } from "@self-engine/db/schema";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { noteIdSchema } from "../../notes-module/contracts/index.ts";

export const basketIdSchema = idSchema("Basket");
export const basketItemIdSchema = idSchema("BasketItem");
export const noteMarkIdSchema = idSchema("NoteMark");

const item = z.object({
  id: basketItemIdSchema,
  basketId: basketIdSchema.nullable(),
  noteId: noteIdSchema,
});
const basket = z.object({
  id: basketIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  title: z.string(),
});
const mark = z.object({ id: noteMarkIdSchema, noteId: noteIdSchema.nullable(), label: z.string() });
const basketById = z.strictObject({ id: basketIdSchema });
const itemById = z.strictObject({ id: basketItemIdSchema });

/**
 * A test module with an owner and its Part Rows (ADR 0042): a basket holds items, each of which
 * refers to a note, and a note, a row of another module, holds marks. A loose item or a mark that
 * names no owner is an ordinary row.
 */
export const basketsContract = {
  create: oc
    .input(z.strictObject({ title: z.string().min(1) }))
    .output(basket)
    .errors({ ...refusal }),
  get: oc
    .input(basketById)
    .output(basket.extend({ items: z.array(item) }))
    .errors({ NOT_FOUND: {} }),
  delete: oc
    .input(basketById)
    .output(basket)
    .errors({ NOT_FOUND: {}, ...refusal }),
  restore: oc
    .input(basketById)
    .output(basket)
    .errors({ NOT_FOUND: {}, ...refusal }),
  addItem: oc
    .input(z.strictObject({ basketId: basketIdSchema.nullable(), noteId: noteIdSchema }))
    .output(item)
    .errors({ ...refusal }),
  moveItem: oc
    .input(itemById.extend({ noteId: noteIdSchema }))
    .output(item)
    .errors({ NOT_FOUND: {}, ...refusal }),
  removeItem: oc
    .input(itemById)
    .output(item)
    .errors({ NOT_FOUND: {}, ...refusal }),
  restoreItem: oc
    .input(itemById)
    .output(item)
    .errors({ NOT_FOUND: {}, ...refusal }),
  mark: oc
    .input(z.strictObject({ noteId: noteIdSchema.nullable(), label: z.string().min(1) }))
    .output(mark)
    .errors({ ...refusal }),
  marks: oc.input(z.strictObject({})).output(z.array(mark)),
};
