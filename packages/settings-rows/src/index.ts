// The Settings table below Storage (D352), as `spaces` is: its row map, its migration and the
// read of one Setting. No Contract and no entry a page can call; Storage puts the read on the
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
export { readSetting, type SettingsReader } from "./read.ts";
