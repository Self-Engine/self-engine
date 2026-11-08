import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { createTestAdapter, describeAdapterContract, settle } from "../testing/index.ts";
import {
  createLocalSettingsAdapter,
  createSettingsStore,
  defineSetting,
  type LocalSettingsStorage,
  type LocalStorageChange,
  type LocalStorageEvents,
  type ReportedSettingEntry,
  type SettingsStorageFailure,
} from "./index.ts";

/** Named like the exceptions `localStorage` throws. */
function storageError(message: string, name: string): Error {
  return Object.assign(new Error(message), { name });
}

interface SimulatedStorage extends LocalSettingsStorage {
  readonly items: Map<string, string>;
  readonly breakReads: () => () => void;
  readonly breakWrites: () => () => void;
  /** Writing this one item fails until the returned function is called. */
  readonly breakWritesOf: (item: string) => () => void;
  /** A write fails if the values would then take more than `characters` in total. */
  readonly limitQuota: (characters: number) => void;
}

/** Behaves like `localStorage` for the methods the adapter uses, and can fail like it. */
function simulatedStorage(): SimulatedStorage {
  const items = new Map<string, string>();
  let readable = true;
  let quota = Infinity;
  let unwritable: string | undefined;

  function assertReadable(): void {
    if (!readable) throw storageError("blocked", "SecurityError");
  }
  function assertFits(key: string, value: string): void {
    const others = [...items].filter(([item]) => item !== key);
    const used = others.reduce((sum, [, text]) => sum + text.length, 0);
    if (used + value.length > quota) throw storageError("over quota", "QuotaExceededError");
  }

  return {
    items,
    get length() {
      assertReadable();
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => {
      assertReadable();
      return items.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (key === unwritable) throw storageError("write rejected", "UnknownError");
      assertFits(key, value);
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    breakReads: () => {
      readable = false;
      return () => {
        readable = true;
      };
    },
    breakWrites: () => {
      quota = 0;
      return () => {
        quota = Infinity;
      };
    },
    breakWritesOf: (item) => {
      unwritable = item;
      return () => {
        unwritable = undefined;
      };
    },
    limitQuota: (characters) => {
      quota = characters;
    },
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
    { getStorage: () => storage, getEvents: () => events },
    "synced",
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
  return {
    open: () => adapter,
    changeFromOutside: adapter.changeFromOutside,
    breakReads: () => adapter.failLoads(),
    breakWrites: () => adapter.failSaves(),
    // This adapter applies a batch in one step, so a failing entry fails all of it.
    breakWritesOf: () => adapter.failSaves(),
  };
});

describeAdapterContract("localStorage", () => {
  const storage = simulatedStorage();
  const events = simulatedEvents();
  return {
    open: () =>
      createLocalSettingsAdapter({ getStorage: () => storage, getEvents: () => events }, "synced"),
    changeFromOutside: (entries) => {
      for (const { key, value } of entries) {
        const item = SYNCED_PREFIX + key;
        const newValue = value === undefined ? null : JSON.stringify(value);
        if (newValue === null) storage.items.delete(item);
        else storage.items.set(item, newValue);
        events.dispatch({ key: item, newValue, storageArea: storage });
      }
    },
    breakReads: storage.breakReads,
    breakWrites: storage.breakWrites,
    breakWritesOf: (key) => storage.breakWritesOf(SYNCED_PREFIX + key),
  };
});

const accent = defineSetting({
  key: "test.accent",
  scope: "synced",
  default: "blue",
  schema: z.string(),
});

const tint = defineSetting({
  key: "test.tint",
  scope: "synced",
  default: false,
  schema: z.boolean(),
});

function storeOverStorage(getStorage: () => LocalSettingsStorage) {
  const failures: SettingsStorageFailure[] = [];
  const events = simulatedEvents();
  const environment = { getStorage, getEvents: () => events };
  const store = createSettingsStore({
    adapters: {
      synced: createLocalSettingsAdapter(environment, "synced"),
      device: createLocalSettingsAdapter(environment, "device"),
    },
    onError: (failure) => failures.push(failure),
  });
  return { store, failures };
}

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
    const environment = { getStorage: () => storage, getEvents: () => events };
    const synced = createLocalSettingsAdapter(environment, "synced");
    const device = createLocalSettingsAdapter(environment, "device");

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

  it("skips an unparsable item and still loads the others", async () => {
    const storage = simulatedStorage();
    storage.items.set(`${SYNCED_PREFIX}test.accent`, "{not json");
    storage.items.set(`${SYNCED_PREFIX}test.tint`, "true");

    const adapter = createLocalSettingsAdapter({ getStorage: () => storage, getEvents: simulatedEvents }, "synced");

    await expect(adapter.load()).resolves.toEqual([{ key: "test.tint", value: true }]);
  });

  it("rejects load when the storage itself cannot be reached", async () => {
    const adapter = createLocalSettingsAdapter(
      {
        getStorage: () => {
          throw storageError("blocked", "SecurityError");
        },
        getEvents: simulatedEvents,
      },
      "synced",
    );

    await expect(adapter.load()).rejects.toThrow("blocked");
  });

  it("restores a batch within the quota that ran out midway", async () => {
    const storage = simulatedStorage();
    const adapter = createLocalSettingsAdapter({ getStorage: () => storage, getEvents: simulatedEvents }, "synced");
    await adapter.save([{ key: "test.changed", value: "stored" }]);
    storage.limitQuota(12);

    await expect(
      adapter.save([
        { key: "test.changed", value: "new" },
        { key: "test.added", value: "new" },
        { key: "test.overflow", value: "does not fit" },
      ]),
    ).rejects.toThrow("over quota");

    expect([...storage.items]).toEqual([[`${SYNCED_PREFIX}test.changed`, '"stored"']]);
  });
});

describe("the store over a damaged or blocked localStorage", () => {
  it("shows the default for a damaged entry only, and keeps the item until that Setting changes", async () => {
    const storage = simulatedStorage();
    storage.items.set(`${SYNCED_PREFIX}test.accent`, "{not json");
    storage.items.set(`${SYNCED_PREFIX}test.tint`, "true");
    const { store, failures } = storeOverStorage(() => storage);

    await store.load();
    await settle();

    expect(store.read(accent)).toBe("blue");
    expect(store.read(tint)).toBe(true);
    expect(storage.items.get(`${SYNCED_PREFIX}test.accent`)).toBe("{not json");
    expect(failures).toEqual([]);

    store.write(accent, "green");
    await settle();

    expect(storage.items.get(`${SYNCED_PREFIX}test.accent`)).toBe('"green"');
  });

  it("starts from defaults and reports once per scope when localStorage is blocked", async () => {
    const { store, failures } = storeOverStorage(() => {
      throw storageError("blocked", "SecurityError");
    });

    await expect(store.load()).resolves.toBeUndefined();

    expect(store.read(accent)).toBe("blue");
    expect(failures.map(({ operation, scope }) => [operation, scope])).toEqual([
      ["load", "synced"],
      ["load", "device"],
    ]);
  });

  it("keeps the value and reports when the quota is exceeded", async () => {
    const storage = simulatedStorage();
    const { store, failures } = storeOverStorage(() => storage);
    await store.load();
    storage.breakWrites();

    store.write(accent, "green");
    await settle();

    expect(store.read(accent)).toBe("green");
    expect(failures.map(({ operation, scope }) => [operation, scope])).toEqual([
      ["save", "synced"],
    ]);
    expect(failures[0]?.error.message).toContain("QuotaExceededError");
  });
});
