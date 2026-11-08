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

/** The storage and where its events arrive. Both are getters, because reaching them can throw. */
export interface LocalSettingsEnvironment {
  readonly getStorage: () => LocalSettingsStorage;
  readonly getEvents: () => LocalStorageEvents;
}

/** How the entries of one scope are named in the storage. */
function itemNames(scope: SettingScope) {
  const prefix = `self-engine:settings:${scope}:`;
  return {
    itemOf: (key: string): string => prefix + key,
    /** `undefined` for an item outside this scope. */
    keyOf: (item: string): string | undefined =>
      item.startsWith(prefix) ? item.slice(prefix.length) : undefined,
  };
}

export function createLocalSettingsAdapter(
  { getStorage, getEvents }: LocalSettingsEnvironment,
  scope: SettingScope,
): SettingsAdapter {
  const { itemOf, keyOf } = itemNames(scope);
  // A cleared storage names no keys, so what it removed has to be known from before.
  const known = new Set<string>();

  function reportedBy({
    key: item,
    newValue,
  }: LocalStorageChange): readonly ReportedSettingEntry[] {
    if (item === null) {
      const removed = [...known].map((key) => ({ key, value: undefined }));
      known.clear();
      return removed;
    }
    const key = keyOf(item);
    if (key === undefined) return [];
    if (newValue === null) known.delete(key);
    else known.add(key);
    return [{ key, value: newValue === null ? undefined : parseItem(newValue) }];
  }

  return {
    load: async () => {
      const storage = getStorage();
      const entries: SettingEntry[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const item = storage.key(index);
        const key = item === null ? undefined : keyOf(item);
        if (item === null || key === undefined) continue;
        const text = storage.getItem(item);
        if (text === null) continue;
        known.add(key);
        const value = parseItem(text);
        if (value !== undefined) entries.push({ key, value });
      }
      return entries;
    },
    save: async (entries) => {
      const storage = getStorage();
      const before = entries.map(({ key }) => {
        const item = itemOf(key);
        return [item, storage.getItem(item)] as const;
      });
      try {
        for (const { key, value } of entries) storage.setItem(itemOf(key), JSON.stringify(value));
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
