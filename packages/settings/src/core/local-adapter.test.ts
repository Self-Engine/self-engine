import { describe, expect, it } from "vite-plus/test";
import { createTestAdapter, describeAdapterContract } from "../testing/index.ts";
import {
  createLocalSettingsAdapter,
  type LocalSettingsStorage,
  type LocalStorageChange,
  type LocalStorageEvents,
  type ReportedSettingEntry,
} from "./index.ts";

/** Behaves like `localStorage` for the methods the adapter uses. */
function simulatedStorage(): LocalSettingsStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
}

/** Behaves like `window` for `storage` events, which arrive when another tab changed something. */
function simulatedEvents(): LocalStorageEvents & {
  readonly dispatch: (event: LocalStorageChange) => void;
} {
  const listeners = new Set<(event: LocalStorageChange) => void>();
  return {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    dispatch: (event) => {
      for (const listener of listeners) listener(event);
    },
  };
}

const SYNCED_PREFIX = "self-engine:settings:synced:";

function localAdapter() {
  const storage = simulatedStorage();
  const events = simulatedEvents();
  const adapter = createLocalSettingsAdapter(
    () => storage,
    "synced",
    () => events,
  );
  const reported: ReportedSettingEntry[] = [];
  return {
    storage,
    events,
    adapter,
    reported,
    listen: () => adapter.subscribe((e) => reported.push(...e)),
  };
}

describeAdapterContract("in memory", () => {
  const adapter = createTestAdapter();
  return { open: () => adapter, changeFromOutside: adapter.changeFromOutside };
});

describeAdapterContract("localStorage", () => {
  const storage = simulatedStorage();
  const events = simulatedEvents();
  return {
    open: () =>
      createLocalSettingsAdapter(
        () => storage,
        "synced",
        () => events,
      ),
    changeFromOutside: (entries) => {
      for (const { key, value } of entries) {
        const item = SYNCED_PREFIX + key;
        const newValue = value === undefined ? null : JSON.stringify(value);
        if (newValue === null) storage.items.delete(item);
        else storage.items.set(item, newValue);
        events.dispatch({ key: item, newValue, storageArea: storage });
      }
    },
  };
});

describe("the localStorage adapter", () => {
  it("stores each entry as its own item with a JSON value", async () => {
    const { storage, adapter } = localAdapter();

    await adapter.save([
      { key: "test.a", value: "text" },
      { key: "test.b", value: { nested: 1 } },
    ]);

    expect([...storage.items.values()]).toEqual(['"text"', '{"nested":1}']);
  });

  it("keeps Synced and Device Settings apart in one storage", async () => {
    const { storage, events } = localAdapter();
    const synced = createLocalSettingsAdapter(
      () => storage,
      "synced",
      () => events,
    );
    const device = createLocalSettingsAdapter(
      () => storage,
      "device",
      () => events,
    );

    await synced.save([{ key: "test.same", value: "synced" }]);
    await device.save([{ key: "test.same", value: "device" }]);

    await expect(synced.load()).resolves.toEqual([{ key: "test.same", value: "synced" }]);
    await expect(device.load()).resolves.toEqual([{ key: "test.same", value: "device" }]);
    expect(storage.items.size).toBe(2);
  });

  it("does not load items of anyone else in the same storage", async () => {
    const { storage, adapter } = localAdapter();
    storage.items.set("self-engine:start-cache", "not json");

    await expect(adapter.load()).resolves.toEqual([]);
  });

  it("ignores storage events for another scope, for anyone else, and for sessionStorage", () => {
    const { storage, events, reported, listen } = localAdapter();
    listen();

    events.dispatch({
      key: "self-engine:settings:device:test.a",
      newValue: "1",
      storageArea: storage,
    });
    events.dispatch({ key: "self-engine:start-cache", newValue: "1", storageArea: storage });
    events.dispatch({ key: `${SYNCED_PREFIX}test.a`, newValue: "1", storageArea: {} });

    expect(reported).toEqual([]);
  });

  it("reports an unparsable item like an absent entry and leaves it stored", () => {
    const { storage, events, reported, listen } = localAdapter();
    listen();
    storage.items.set(`${SYNCED_PREFIX}test.a`, "{broken");

    events.dispatch({ key: `${SYNCED_PREFIX}test.a`, newValue: "{broken", storageArea: storage });

    expect(reported).toStrictEqual([{ key: "test.a", value: undefined }]);
    expect(storage.items.get(`${SYNCED_PREFIX}test.a`)).toBe("{broken");
  });

  it("reports every entry it knows as absent when the storage was cleared", async () => {
    const { storage, events, adapter, reported, listen } = localAdapter();
    storage.items.set(`${SYNCED_PREFIX}test.loaded`, "1");
    await adapter.load();
    await adapter.save([{ key: "test.saved", value: 2 }]);
    listen();
    events.dispatch({ key: `${SYNCED_PREFIX}test.reported`, newValue: "3", storageArea: storage });
    reported.length = 0;

    storage.items.clear();
    events.dispatch({ key: null, newValue: null, storageArea: storage });

    expect(reported.toSorted((a, b) => a.key.localeCompare(b.key))).toStrictEqual([
      { key: "test.loaded", value: undefined },
      { key: "test.reported", value: undefined },
      { key: "test.saved", value: undefined },
    ]);
  });

  it("does not report a clear when it knows no entries", () => {
    const { storage, events, adapter } = localAdapter();
    let reports = 0;
    adapter.subscribe(() => (reports += 1));

    events.dispatch({ key: null, newValue: null, storageArea: storage });

    expect(reports).toBe(0);
  });
});
