import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { createTestAdapter, describeAdapterContract, settle } from "../testing/index.ts";
import {
  createLocalSettingsAdapter,
  createSettingsStore,
  defineSetting,
  type LocalSettingsStorage,
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
  /** A write fails if the values would then take more than `characters` in total. */
  readonly limitQuota: (characters: number) => void;
}

/** Behaves like `localStorage` for the methods the adapter uses, and can fail like it. */
function simulatedStorage(): SimulatedStorage {
  const items = new Map<string, string>();
  let readable = true;
  let quota = Infinity;

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
    limitQuota: (characters) => {
      quota = characters;
    },
  };
}

describeAdapterContract("in memory", () => {
  const adapter = createTestAdapter();
  return {
    open: () => adapter,
    breakReads: () => adapter.failLoads(),
    breakWrites: () => adapter.failSaves(),
  };
});

describeAdapterContract("localStorage", () => {
  const storage = simulatedStorage();
  return {
    open: () => createLocalSettingsAdapter(() => storage, "synced"),
    breakReads: storage.breakReads,
    breakWrites: storage.breakWrites,
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

const ITEM = "self-engine:settings:synced:";

function storeOverStorage(getStorage: () => LocalSettingsStorage) {
  const failures: SettingsStorageFailure[] = [];
  const store = createSettingsStore({
    adapters: {
      synced: createLocalSettingsAdapter(getStorage, "synced"),
      device: createLocalSettingsAdapter(getStorage, "device"),
    },
    onError: (failure) => failures.push(failure),
  });
  return { store, failures };
}

describe("the localStorage adapter", () => {
  it("stores each entry as its own item with a JSON value", async () => {
    const storage = simulatedStorage();

    await createLocalSettingsAdapter(() => storage, "device").save([
      { key: "test.a", value: "text" },
      { key: "test.b", value: { nested: 1 } },
    ]);

    expect([...storage.items.values()]).toEqual(['"text"', '{"nested":1}']);
  });

  it("keeps Synced and Device Settings apart in one storage", async () => {
    const storage = simulatedStorage();
    const synced = createLocalSettingsAdapter(() => storage, "synced");
    const device = createLocalSettingsAdapter(() => storage, "device");

    await synced.save([{ key: "test.same", value: "synced" }]);
    await device.save([{ key: "test.same", value: "device" }]);

    await expect(synced.load()).resolves.toEqual([{ key: "test.same", value: "synced" }]);
    await expect(device.load()).resolves.toEqual([{ key: "test.same", value: "device" }]);
    expect(storage.items.size).toBe(2);
  });

  it("does not load items of anyone else in the same storage", async () => {
    const storage = simulatedStorage();
    storage.items.set("self-engine:start-cache", "not json");

    await expect(createLocalSettingsAdapter(() => storage, "synced").load()).resolves.toEqual([]);
  });

  it("skips an unparsable item and still loads the others", async () => {
    const storage = simulatedStorage();
    storage.items.set(`${ITEM}test.accent`, "{not json");
    storage.items.set(`${ITEM}test.tint`, "true");

    await expect(createLocalSettingsAdapter(() => storage, "synced").load()).resolves.toEqual([
      { key: "test.tint", value: true },
    ]);
  });

  it("rejects load when the storage itself cannot be reached", async () => {
    const adapter = createLocalSettingsAdapter(() => {
      throw storageError("blocked", "SecurityError");
    }, "synced");

    await expect(adapter.load()).rejects.toThrow("blocked");
  });

  it("applies a batch together: when the quota runs out midway, nothing changes", async () => {
    const storage = simulatedStorage();
    const adapter = createLocalSettingsAdapter(() => storage, "synced");
    await adapter.save([{ key: "test.changed", value: "stored" }]);
    storage.limitQuota(12);

    await expect(
      adapter.save([
        { key: "test.changed", value: "new" },
        { key: "test.added", value: "new" },
        { key: "test.overflow", value: "does not fit" },
      ]),
    ).rejects.toThrow("over quota");

    expect([...storage.items]).toEqual([[`${ITEM}test.changed`, '"stored"']]);
  });
});

describe("the store over a damaged or blocked localStorage", () => {
  it("shows the default for a damaged entry only, and keeps the item until that Setting changes", async () => {
    const storage = simulatedStorage();
    storage.items.set(`${ITEM}test.accent`, "{not json");
    storage.items.set(`${ITEM}test.tint`, "true");
    const { store, failures } = storeOverStorage(() => storage);

    await store.load();
    await settle();

    expect(store.read(accent)).toBe("blue");
    expect(store.read(tint)).toBe(true);
    expect(storage.items.get(`${ITEM}test.accent`)).toBe("{not json");
    expect(failures).toEqual([]);

    store.write(accent, "green");
    await settle();

    expect(storage.items.get(`${ITEM}test.accent`)).toBe('"green"');
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
