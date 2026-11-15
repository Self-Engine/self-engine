import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/storage";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { projectIdSchema } from "../../../src/contracts/index.ts";
import { projectEntryIdSchema } from "../contracts/index.ts";

export const projectEntriesMigrations = defineMigrations(
  "project-entries",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

// Only its own table: `projects` is read through the released Read Piece (D241).
export const projectEntriesRowMap = {
  project_entries: z.object({
    id: projectEntryIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    project_id: projectIdSchema,
    label: z.string(),
  }),
};

export const toProjectEntry = (row: TablesOf<typeof projectEntriesRowMap>["project_entries"]) => ({
  id: row.id,
  label: row.label,
  projectId: row.project_id,
});
