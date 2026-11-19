import { SETTINGS_TABLE, settingIdSchema, settingsRowMap } from "@self-engine/settings-rows";
import { defineStorageModule, sharedEntry, sharedWrites, smallSetList } from "@self-engine/storage";
import { settingEntrySchema, settingsContract } from "../contracts/index.ts";

export const settings = defineStorageModule({
  name: "settings",
  contract: settingsContract,
  // The kit requires a reason for the index; save replaces an existing key and declares no Conflict.
  conflicts: { settings_live_key: "key_taken" },
  migrations: [],
  rowMap: settingsRowMap,
}).entries({
  load: smallSetList([SETTINGS_TABLE], async (tx, context) => {
    const rows = await sharedEntry(tx, context)
      .live(SETTINGS_TABLE)
      .select(["key", "value"])
      .execute();
    const entries = [];
    for (const { key, value } of rows) {
      let decoded: unknown;
      try {
        decoded = JSON.parse(value);
      } catch {
        // Leave an unreadable value in the database.
        continue;
      }
      const entry = settingEntrySchema.safeParse({ key, value: decoded });
      if (entry.success) entries.push(entry.data);
    }
    return entries;
  }),
  save: {
    kind: "operation",
    async run(tx, context, { entries }) {
      if (entries.length === 0) return;
      const values = new Map(entries.map(({ key, value }) => [key, value]));
      const rows = sharedWrites(tx, context);
      const existing = await rows
        .live(SETTINGS_TABLE)
        .select(["key", "id"])
        .where("key", "in", [...values.keys()])
        .execute();
      const ids = new Map(existing.map(({ key, id }) => [key, id]));
      for (const [key, value] of values) {
        const text = JSON.stringify(value);
        const id = ids.get(key);
        if (id === undefined) {
          await rows.insert(SETTINGS_TABLE, context.newId(settingIdSchema), { key, value: text });
        } else {
          await rows.update(SETTINGS_TABLE, id, { value: text });
        }
      }
    },
  },
});
