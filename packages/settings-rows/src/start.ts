import { newId, type Database } from "@self-engine/db";
import type { JsonValue, SettingDeclaration } from "@self-engine/settings";
import type { SpaceId, SpaceSources } from "@self-engine/spaces";
import type { SettingId, SettingsTables } from "./rows.ts";

const entry = Symbol("start Setting");

/** A Synced Setting and its initial value, paired by `startSetting`. */
export interface StartSetting {
  readonly [entry]: { readonly key: string; readonly value: string };
}

/** Prepares a value to write at startup if the Synced Setting is missing. */
export function startSetting<T extends JsonValue>(
  setting: SettingDeclaration<T, "synced">,
  value: NoInfer<T>,
): StartSetting {
  return { [entry]: { key: setting.key, value: JSON.stringify(value) } };
}

/** Writes the missing Settings as one batch, leaving existing values untouched. */
export async function writeMissingSettings(
  database: Database,
  spaceId: SpaceId,
  settings: readonly StartSetting[],
  sources: SpaceSources,
): Promise<void> {
  if (settings.length === 0) return;
  const db = database.kysely.withTables<SettingsTables>();
  const entries = settings.map((setting) => setting[entry]);
  const existing = await db
    .selectFrom("settings")
    .select("key")
    .where("space_id", "=", spaceId)
    .where(
      "key",
      "in",
      entries.map(({ key }) => key),
    )
    .where("deleted_at", "is", null)
    .execute();
  const present = new Set(existing.map(({ key }) => key));
  const missing = entries.filter(({ key }) => !present.has(key));
  if (missing.length === 0) return;

  // Start the transaction with the insert, so there's no read snapshot to upgrade.
  // If another Data Process wrote the key since the lookup, its row wins.
  const now = sources.clock();
  const ids = { clock: () => now, random: sources.ids.random };
  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("settings")
      .values(
        missing.map(({ key, value }) => ({
          id: newId<SettingId>(ids),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          space_id: spaceId,
          key,
          value,
        })),
      )
      .onConflict((conflict) =>
        conflict.columns(["space_id", "key"]).where("deleted_at", "is", null).doNothing(),
      )
      .execute();
  });
}
