// One storage item per entry, under one key prefix per scope. The caller hands in the storage,
// so this file stays free of the DOM and works in the web app and the Electron renderer alike.

import type { SettingEntry, SettingsAdapter } from "./adapter.ts";
import type { JsonValue, SettingScope } from "./setting.ts";

/** The part of `localStorage` the adapter uses. */
export interface LocalSettingsStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createLocalSettingsAdapter(
  getStorage: () => LocalSettingsStorage,
  scope: SettingScope,
): SettingsAdapter {
  const prefix = `self-engine:settings:${scope}:`;

  return {
    load: async () => {
      const storage = getStorage();
      const entries: SettingEntry[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const item = storage.key(index);
        if (item === null || !item.startsWith(prefix)) continue;
        const text = storage.getItem(item);
        if (text === null) continue;
        entries.push({ key: item.slice(prefix.length), value: JSON.parse(text) as JsonValue });
      }
      return entries;
    },
    save: async (entries) => {
      const storage = getStorage();
      for (const { key, value } of entries) storage.setItem(prefix + key, JSON.stringify(value));
    },
  };
}
