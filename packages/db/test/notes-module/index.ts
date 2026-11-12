// Test-only reference for the row-map pattern; no runtime entry imports this module.
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { defineMigrations, type TablesOf } from "../../src/core/index.ts";
import { idSchema, sqliteBoolean } from "../../src/schema/index.ts";

export const notesMigrations = defineMigrations(
  "notes",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

export const noteIdSchema = idSchema("Note");
export type NoteId = z.output<typeof noteIdSchema>;

export const notesRowMap = {
  notes: z.object({
    id: noteIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: idSchema("Space"),
    title: z.string(),
    is_pinned: sqliteBoolean,
  }),
};
export type NoteRow = TablesOf<typeof notesRowMap>["notes"];

export const noteSchema = z.object({
  id: noteIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  title: z.string(),
  isPinned: z.boolean(),
});
export type Note = z.output<typeof noteSchema>;

// Do not parse the row here: agreement is checked in tests, not on every query.
export function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    isPinned: row.is_pinned === 1,
  };
}
