// One storage item per entry, under one key prefix per scope. The caller hands in the storage and
// the source of its events, so this file stays free of the DOM and works in the web app and the
// Electron renderer alike.

import type { ReportedSettingEntry, SettingEntry, SettingsAdapter } from "./adapter.ts";
import type { JsonValue, SettingScope } from "./setting.ts";

/** The part of `localStorage` the adapter uses. */
export interface LocalSettingsStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `undefined` for an item that is damaged, which is damaged for this entry alone. */
function parseItem(text: string): JsonValue | undefined {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    // Safe to ignore: the Setting shows its default and the item stays stored.
    return undefined;
  }
}

/** Newest first, so every step is a state that fit into the quota before. */
function restoreItems(
  storage: LocalSettingsStorage,
  before: readonly (readonly [item: string, text: string | null])[],
): void {
  for (const [item, text] of before.toReversed()) {
    try {
      if (text === null) storage.removeItem(item);
      else storage.setItem(item, text);
    } catch {
      // The save has failed already; what the caller learns is why, not this.
    }
  }
}

/** The part of a `storage` event the adapter reads. */
export interface LocalStorageChange {
  /** `null` when the whole storage was cleared. */
  readonly key: string | null;
  /** `null` when the item was removed. */
  readonly newValue: string | null;
  readonly storageArea: unknown;
}

/** Where `storage` events arrive: `window` in the app. They only report other tabs' changes. */
export interface LocalStorageEvents {
  addEventListener(type: "storage", listener: (event: LocalStorageChange) => void): void;
  removeEventListener(type: "storage", listener: (event: LocalStorageChange) => void): void;
}

export function createLocalSettingsAdapter(
  getStorage: () => LocalSettingsStorage,
  scope: SettingScope,
  getEvents: () => LocalStorageEvents,
): SettingsAdapter {
  const prefix = `self-engine:settings:${scope}:`;
  // A cleared storage names no keys, so what it removed has to be known from before.
  const known = new Set<string>();

  function reportedBy({ key, newValue }: LocalStorageChange): readonly ReportedSettingEntry[] {
    if (key === null) {
      const removed = [...known].map((entry) => ({ key: entry, value: undefined }));
      known.clear();
      return removed;
    }
    if (!key.startsWith(prefix)) return [];
    const entry = key.slice(prefix.length);
    if (newValue === null) known.delete(entry);
    else known.add(entry);
    return [{ key: entry, value: newValue === null ? undefined : parseItem(newValue) }];
  }

  return {
    load: async () => {
      const storage = getStorage();
      const entries: SettingEntry[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const item = storage.key(index);
        if (item === null || !item.startsWith(prefix)) continue;
        const text = storage.getItem(item);
        if (text === null) continue;
        const key = item.slice(prefix.length);
        known.add(key);
        const value = parseItem(text);
        if (value !== undefined) entries.push({ key, value });
      }
      return entries;
    },
    save: async (entries) => {
      const storage = getStorage();
      const before = entries.map(
        ({ key }) => [prefix + key, storage.getItem(prefix + key)] as const,
      );
      try {
        for (const { key, value } of entries) storage.setItem(prefix + key, JSON.stringify(value));
      } catch (error) {
        restoreItems(storage, before);
        throw error;
      }
      for (const { key } of entries) known.add(key);
    },
    subscribe: (listener) => {
      const events = getEvents();
      const onStorage = (event: LocalStorageChange): void => {
        if (event.storageArea !== getStorage()) return;
        const reported = reportedBy(event);
        if (reported.length > 0) listener(reported);
      };
      events.addEventListener("storage", onStorage);
      return () => events.removeEventListener("storage", onStorage);
    },
  };
}
