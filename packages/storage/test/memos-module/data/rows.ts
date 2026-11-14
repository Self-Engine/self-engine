// Test-only reference for the edit pattern; no runtime entry imports this module.
import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/spaces";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { memoIdSchema, memoSchema } from "../contracts/index.ts";

export const memosMigrations = defineMigrations(
  "memos",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

export const memosRowMap = {
  memos: z.object({
    id: memoIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    title: z.string(),
    body: z.string().nullable(),
    color: z.string().nullable(),
  }),
};
type MemoRow = TablesOf<typeof memosRowMap>["memos"];

export function toMemo(row: MemoRow): z.output<typeof memoSchema> {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    body: row.body,
    color: row.color,
  };
}
