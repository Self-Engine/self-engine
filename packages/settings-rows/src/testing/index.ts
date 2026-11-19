// For tests only: rows of the Settings table, written as a test needs them, broken ones too.

import type { JsonValue } from "@self-engine/settings";
import type { SpaceId } from "@self-engine/spaces";
import { FIRST_SPACE_ID } from "@self-engine/spaces/testing";
import { requireInstant } from "@self-engine/time/testing";
import type { Kysely } from "kysely";
import { settingIdSchema, type SettingRow, type SettingsTables } from "../rows.ts";

/** The Instant a test Setting row carries. */
const WRITTEN_AT = requireInstant("2026-01-01T00:00:00.000Z");

export type TestSettingRow = {
  readonly key: string;
  /** Default: the Space of a test context. */
  readonly spaceId?: SpaceId;
} & (
  | { readonly value: JsonValue; readonly text?: undefined }
  /** The stored text as it is, for a row that holds no JSON. */
  | { readonly text: string; readonly value?: undefined }
);

let counted = 0;

/** A fixed, well-formed id for a test Setting row, counted per test file. */
function nextId() {
  counted += 1;
  return settingIdSchema.parse(`00000000-0000-7000-9000-${counted.toString(16).padStart(12, "0")}`);
}

/**
 * Inserts Setting rows into a database that ran the migrations of `spaces` and `settings`,
 * through `db` or an open transaction, and returns them.
 */
export async function createSettingRows<DB>(
  db: Kysely<DB>,
  settings: readonly TestSettingRow[],
): Promise<SettingRow[]> {
  const rows = settings.map(
    (setting): SettingRow => ({
      id: nextId(),
      created_at: WRITTEN_AT,
      updated_at: WRITTEN_AT,
      deleted_at: null,
      space_id: setting.spaceId ?? FIRST_SPACE_ID,
      key: setting.key,
      value: setting.text ?? JSON.stringify(setting.value),
    }),
  );
  // The caller's tables say nothing about `settings`; the migration of `settings` is what this needs.
  const settingsDb = db as unknown as Kysely<SettingsTables>;
  if (rows.length > 0) await settingsDb.insertInto("settings").values(rows).execute();
  return rows;
}
