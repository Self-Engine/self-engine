import { defineMigrations, type TablesOf } from "@self-engine/db";
import { idSchema } from "@self-engine/db/schema";
import { spaceIdSchema } from "@self-engine/spaces";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";

/** The id of a Setting's row. */
export const settingIdSchema = idSchema("Setting");
export type SettingId = z.output<typeof settingIdSchema>;

export const settingsMigrations = defineMigrations(
  "settings",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

/**
 * One row per Setting of a Space (D352). `value` is the Setting's value as JSON text; only the
 * Setting's declaration knows its type, so the row map takes any text and the read checks it.
 * A row is never soft deleted: a reset writes the default.
 */
export const settingsRowMap = {
  settings: z.object({
    id: settingIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    key: z.string(),
    value: z.string(),
  }),
};
export type SettingsTables = TablesOf<typeof settingsRowMap>;
export type SettingRow = SettingsTables["settings"];

/** The table's name, for the declared reads of a Query that reads a Setting (D352). */
export const SETTINGS_TABLE = "settings" satisfies keyof SettingsTables;
