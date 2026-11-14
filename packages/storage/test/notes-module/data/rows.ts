// Test-only reference for the row-map pattern; no runtime entry imports this module.
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { defineMigrations, type TablesOf } from "@self-engine/db";
import { sqliteBoolean } from "@self-engine/db/schema";
import { spaceIdSchema } from "@self-engine/spaces";

export const notesMigrations = defineMigrations(
  "notes",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

import { noteIdSchema, noteSchema } from "../contracts/index.ts";
export { noteIdSchema, noteSchema };
export type NoteId = z.output<typeof noteIdSchema>;

export const notesRowMap = {
  notes: z.object({
    id: noteIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    title: z.string(),
    is_pinned: sqliteBoolean,
  }),
};
export type NoteRow = TablesOf<typeof notesRowMap>["notes"];

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
