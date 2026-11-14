import { defineMigrations, type TablesOf } from "@self-engine/db";
import { idSchema } from "@self-engine/db/schema";
import { instantSchema, type Instant } from "@self-engine/time";
import { z } from "zod";

/** The id of a Space: the one schema of it in the repo. */
export const spaceIdSchema = idSchema("Space");
export type SpaceId = z.output<typeof spaceIdSchema>;

/**
 * What a Space is. Checked here and not in SQL, so a later kind such as an organization needs no
 * rebuild of the table every other table refers to (D289).
 */
export const spaceKindSchema = z.enum(["personal"]);
export type SpaceKind = z.output<typeof spaceKindSchema>;

export const spacesMigrations = defineMigrations(
  "spaces",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

export const spacesRowMap = {
  spaces: z.object({
    id: spaceIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    // A Space row is its own Space: the table holds `space_id = id`.
    space_id: spaceIdSchema,
    kind: spaceKindSchema,
  }),
};
export type SpacesTables = TablesOf<typeof spacesRowMap>;
export type SpaceRow = SpacesTables["spaces"];

/** A Space as the code sees it, without its `space_id` and `deleted_at` (ADR 0019). */
export interface Space {
  readonly id: SpaceId;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly kind: SpaceKind;
}

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toSpace = (row: SpaceRow): Space => ({
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  kind: row.kind,
});
