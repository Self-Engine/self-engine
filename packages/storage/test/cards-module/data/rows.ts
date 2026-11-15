import { defineMigrations, type TablesOf } from "@self-engine/db";
import { spaceIdSchema } from "@self-engine/spaces";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { cardIdSchema, type cardSchema } from "../contracts/index.ts";

export const cardsMigrations = defineMigrations(
  "cards",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

export const cardsRowMap = {
  cards: z.object({
    id: cardIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    archived_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    title: z.string(),
  }),
};
export type CardRow = TablesOf<typeof cardsRowMap>["cards"];

export function toCard(row: CardRow): z.output<typeof cardSchema> {
  return { id: row.id, updatedAt: row.updated_at, archivedAt: row.archived_at, title: row.title };
}
