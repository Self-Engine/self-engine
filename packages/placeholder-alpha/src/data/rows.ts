import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/storage";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { entryIdSchema, type entrySchema } from "../contracts/index.ts";

export const entriesMigrations = defineMigrations(
  "placeholder-alpha",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

export const entriesRowMap = {
  placeholder_alpha_entries: z.object({
    id: entryIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    name: z.string(),
  }),
};
export type EntryRow = TablesOf<typeof entriesRowMap>["placeholder_alpha_entries"];
export type Entry = z.output<typeof entrySchema>;

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toEntry = (row: EntryRow): Entry => ({ id: row.id, name: row.name });
