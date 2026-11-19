import { settingValue, type JsonValue, type SettingDeclaration } from "@self-engine/settings";
import type { SpaceId } from "@self-engine/spaces";
import type { Kysely } from "kysely";
import { SETTINGS_TABLE, type SettingsTables } from "./rows.ts";

/** What the read needs of a connection or a transaction: a select, nothing that writes. */
export type SettingsReader<DB> = Pick<Kysely<DB>, "selectFrom">;

/**
 * The value a row's text holds, or `undefined` for text that is no JSON: the row stays as it is,
 * and a reader treats the Setting as absent.
 */
export function parseStoredValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Safe to ignore: the row stays as it is, and the reader answers as if it were missing.
    return undefined;
  }
}

/**
 * Reads a Synced Setting of a Space through `tx`, so the answer comes from the caller's
 * transaction. Answers with the stored value if it passes the declaration's schema, otherwise
 * with the declared default. Never writes. One row over the partial unique index on
 * `(space_id, key)`.
 */
export async function readSetting<DB, T extends JsonValue>(
  tx: SettingsReader<DB>,
  spaceId: SpaceId,
  setting: SettingDeclaration<T, "synced">,
): Promise<T> {
  // The caller's tables say nothing about `settings`; the migration of this package made it.
  const reader = tx as unknown as SettingsReader<SettingsTables>;
  const row = await reader
    .selectFrom(SETTINGS_TABLE)
    .select("value")
    .where("space_id", "=", spaceId)
    .where("key", "=", setting.key)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
  return settingValue(setting, row === undefined ? undefined : parseStoredValue(row.value));
}
