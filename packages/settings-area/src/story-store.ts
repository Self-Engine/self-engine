// Shared by the package's Stories. Not a story file, so the Catalog does not list it.

import {
  createLocalSettingsAdapter,
  createSettingsStore,
  type LocalSettingsStorage,
  type SettingsStore,
} from "@self-engine/settings";

/** A storage in memory that outlives a store, as the browser's outlives a restart. */
export function memoryStorage(): LocalSettingsStorage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (item) => items.get(item) ?? null,
    setItem: (item, text) => void items.set(item, text),
    removeItem: (item) => void items.delete(item),
  };
}

const NO_OTHER_TABS = { addEventListener: () => {}, removeEventListener: () => {} };

export async function loadedStoreOn(storage: LocalSettingsStorage): Promise<SettingsStore> {
  const environment = { getStorage: () => storage, getEvents: () => NO_OTHER_TABS };
  const store = createSettingsStore({
    adapters: {
      synced: createLocalSettingsAdapter(environment, "synced"),
      device: createLocalSettingsAdapter(environment, "device"),
    },
    onError: ({ error }) => {
      throw error;
    },
  });
  await store.load();
  return store;
}
