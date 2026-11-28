import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/spaces";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { noteIdSchema } from "../../notes-module/contracts/index.ts";
import { basketIdSchema, basketItemIdSchema, noteMarkIdSchema } from "../contracts/index.ts";

export const basketsMigrations = defineMigrations(
  "baskets",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);
const convention = {
  created_at: instantSchema,
  updated_at: instantSchema,
  deleted_at: instantSchema.nullable(),
  space_id: spaceIdSchema,
};
export const basketsRowMap = {
  baskets: z.object({ id: basketIdSchema, ...convention, title: z.string() }),
  basket_items: z.object({
    id: basketItemIdSchema,
    ...convention,
    basket_id: basketIdSchema.nullable(),
    note_id: noteIdSchema,
  }),
  note_marks: z.object({
    id: noteMarkIdSchema,
    ...convention,
    note_id: noteIdSchema.nullable(),
    label: z.string(),
  }),
};
type Tables = TablesOf<typeof basketsRowMap>;

export function toBasket(row: Tables["baskets"]) {
  return { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, title: row.title };
}
export function toItem(row: Tables["basket_items"]) {
  return { id: row.id, basketId: row.basket_id, noteId: row.note_id };
}
export function toMark(row: Tables["note_marks"]) {
  return { id: row.id, noteId: row.note_id, label: row.label };
}
