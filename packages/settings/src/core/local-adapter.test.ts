import { describe, expect, it } from "vite-plus/test";
import { createTestAdapter, describeAdapterContract } from "../testing/index.ts";
import { createLocalSettingsAdapter, type LocalSettingsStorage } from "./index.ts";

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

describeAdapterContract("in memory", () => {
  const adapter = createTestAdapter();
  return { open: () => adapter };
});

describeAdapterContract("localStorage", () => {
  const storage = simulatedStorage();
  return { open: () => createLocalSettingsAdapter(() => storage, "synced") };
});

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
});
