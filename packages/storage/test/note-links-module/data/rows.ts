import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/spaces";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { noteIdSchema } from "../../notes-module/contracts/index.ts";
import { linkIdSchema } from "../contracts/index.ts";
export const linksMigrations = defineMigrations(
  "note-links",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);
export const linksRowMap = {
  note_links: z.object({
    id: linkIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    note_id: noteIdSchema,
    label: z.string(),
  }),
};
export function toLink(row: TablesOf<typeof linksRowMap>["note_links"]) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    noteId: row.note_id,
    label: row.label,
  };
}
