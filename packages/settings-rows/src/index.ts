// The Settings table below Storage (D352), as `spaces` is: its row map, its migration, the
// read of one Setting and the writes at startup. Storage puts the read on the
// context of every Operation and Query.

export {
  SETTINGS_TABLE,
  settingIdSchema,
  settingsMigrations,
  settingsRowMap,
  type SettingId,
  type SettingRow,
  type SettingsTables,
} from "./rows.ts";
export { parseStoredValue, readSetting, type SettingsReader } from "./read.ts";
export { startSetting, writeMissingSettings, type StartSetting } from "./start.ts";
