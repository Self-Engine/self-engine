import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/storage";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { projectIdSchema, type Project } from "../contracts/index.ts";

export const projectsMigrations = defineMigrations(
  "projects",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

export const projectsRowMap = {
  projects: z.object({
    id: projectIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    archived_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    title: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    color: z.string().nullable(),
  }),
};
export type ProjectRow = TablesOf<typeof projectsRowMap>["projects"];

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  title: row.title,
  description: row.description,
  icon: row.icon,
  color: row.color,
  archivedAt: row.archived_at,
});
