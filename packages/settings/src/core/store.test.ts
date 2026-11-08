import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { createTestAdapter, settle, type TestAdapter } from "../testing/index.ts";
import {
  createSettingsStore,
  defineSetting,
  settingChange,
  type SettingsStorageFailure,
} from "./index.ts";

const accent = defineSetting({
  key: "test.accent",
  scope: "synced",
  default: "blue",
  schema: z.string(),
});

const scale = defineSetting({
  key: "test.scale",
  scope: "device",
  default: 0,
  schema: z.number(),
});

const windowSize = defineSetting({
  key: "test.window",
  scope: "synced",
  default: { width: 0, height: 0 },
  schema: z.object({ width: z.number(), height: z.number() }),
});

function storeOver(
  synced: TestAdapter,
  device: TestAdapter = createTestAdapter(),
  onError: (failure: SettingsStorageFailure) => void = () => {},
) {
  return createSettingsStore({ adapters: { synced, device }, onError });
}

/** A store over the two adapters, together with every failure it reported. */
function reportingStore(synced: TestAdapter, device: TestAdapter = createTestAdapter()) {
  const failures: SettingsStorageFailure[] = [];
  return { store: storeOver(synced, device, (failure) => failures.push(failure)), failures };
}

async function loadedStore(synced: TestAdapter, device: TestAdapter = createTestAdapter()) {
  const store = storeOver(synced, device);
  await store.load();
  return store;
}

describe("reading", () => {
  it("returns the default for a Setting that was never stored", async () => {
    const store = await loadedStore(createTestAdapter());
    expect(store.read(accent)).toBe("blue");
  });

  it("returns the stored value when it passes the schema", async () => {
    const store = await loadedStore(createTestAdapter({ "test.accent": "green" }));
    expect(store.read(accent)).toBe("green");
  });

  it("throws before load has resolved", async () => {
    const store = storeOver(createTestAdapter());
    expect(() => store.read(accent)).toThrow(/before load/);
    const loading = store.load();
    expect(() => store.read(accent)).toThrow(/before load/);
    await loading;
    expect(() => store.read(accent)).not.toThrow();
  });

  it("returns the default for a stored value the schema rejects, and never writes", async () => {
    const adapter = createTestAdapter({ "test.accent": 5 });
    const store = await loadedStore(adapter);

    expect(store.read(accent)).toBe("blue");
    await settle();

    expect(adapter.saves).toEqual([]);
    expect(adapter.stored.get("test.accent")).toBe(5);
  });

  it("returns the same object on repeated reads", async () => {
    const store = await loadedStore(createTestAdapter({ "test.window": { width: 3, height: 4 } }));
    expect(store.read(windowSize)).toBe(store.read(windowSize));
    expect(store.read(windowSize)).toEqual({ width: 3, height: 4 });
  });

  it("reads each scope from the adapter of that scope", async () => {
    const store = await loadedStore(
      createTestAdapter({ "test.accent": "from-synced", "test.scale": 1 }),
      createTestAdapter({ "test.accent": "from-device", "test.scale": 2 }),
    );
    expect(store.read(accent)).toBe("from-synced");
    expect(store.read(scale)).toBe(2);
  });

  it("loads each adapter once, however often load is called", async () => {
    const adapter = createTestAdapter();
    const store = storeOver(adapter);

    await Promise.all([store.load(), store.load()]);
    await store.load();

    expect(adapter.loadCount()).toBe(1);
  });

  it("keeps entries nobody declared, for whoever declares them later", async () => {
    const adapter = createTestAdapter({ "plugin.later": "kept" });
    const store = await loadedStore(adapter);

    const later = defineSetting({
      key: "plugin.later",
      scope: "synced",
      default: "unset",
      schema: z.string(),
    });

    expect(store.read(later)).toBe("kept");
  });
});

describe("writing", () => {
  it("changes the snapshot and notifies at once, before anything is saved", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.read(accent)));

    store.write(accent, "green");

    expect(store.read(accent)).toBe("green");
    expect(seen).toEqual(["green"]);
    expect(adapter.saves).toEqual([]);
  });

  it("saves in the background, and a new store on the same adapter sees the value", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);

    store.write(accent, "green");
    await settle();

    const restarted = await loadedStore(adapter);
    expect(restarted.read(accent)).toBe("green");
  });

  it("saves only the changed entry", async () => {
    const adapter = createTestAdapter({ "test.accent": "blue", "plugin.later": "kept" });
    const store = await loadedStore(adapter);

    store.write(accent, "green");
    await settle();

    expect(adapter.saves).toEqual([[{ key: "test.accent", value: "green" }]]);
    expect(adapter.stored.get("plugin.later")).toBe("kept");
  });

  it("neither notifies nor saves when the value is already stored", async () => {
    const adapter = createTestAdapter({ "test.window": { width: 3, height: 4 } });
    const store = await loadedStore(adapter);
    let notified = 0;
    store.subscribe(() => (notified += 1));

    store.write(windowSize, { width: 3, height: 4 });
    await settle();

    expect(notified).toBe(0);
    expect(adapter.saves).toEqual([]);
  });

  it("replaces a stored value the schema rejected once that Setting is written", async () => {
    const adapter = createTestAdapter({ "test.accent": 5 });
    const store = await loadedStore(adapter);

    store.write(accent, "blue");
    await settle();

    expect(adapter.stored.get("test.accent")).toBe("blue");
  });

  it("saves several Settings of one write as one batch per adapter, and notifies once", async () => {
    const synced = createTestAdapter();
    const device = createTestAdapter();
    const store = await loadedStore(synced, device);
    let notified = 0;
    store.subscribe(() => (notified += 1));

    store.writeAll([
      settingChange(accent, "green"),
      settingChange(windowSize, { width: 1, height: 2 }),
      settingChange(scale, 2),
    ]);
    await settle();

    expect(notified).toBe(1);
    expect(synced.saves).toEqual([
      [
        { key: "test.accent", value: "green" },
        { key: "test.window", value: { width: 1, height: 2 } },
      ],
    ]);
    expect(device.saves).toEqual([[{ key: "test.scale", value: 2 }]]);
  });

  it("runs the saves of one adapter in order, so the last write wins in storage", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    const release = adapter.holdSaves();

    store.write(accent, "first");
    store.write(accent, "second");
    await settle();
    expect(adapter.saves).toEqual([[{ key: "test.accent", value: "first" }]]);

    release();
    await settle();
    expect(adapter.saves).toHaveLength(2);
    expect(adapter.stored.get("test.accent")).toBe("second");
  });

  it("throws on an invalid value and changes nothing, also for a valid value beside it", async () => {
    const adapter = createTestAdapter({ "test.accent": "blue" });
    const store = await loadedStore(adapter);
    let notified = 0;
    store.subscribe(() => (notified += 1));

    const invalid = { ...settingChange(scale, 1), value: "not a number" };
    expect(() => store.writeAll([settingChange(accent, "green"), invalid])).toThrow(/test\.scale/);
    await settle();

    expect(store.read(accent)).toBe("blue");
    expect(store.read(scale)).toBe(0);
    expect(notified).toBe(0);
    expect(adapter.saves).toEqual([]);
  });

  it("throws before load has resolved", () => {
    const store = storeOver(createTestAdapter());
    expect(() => store.write(accent, "green")).toThrow(/before load/);
  });

  it("stops notifying after unsubscribing", async () => {
    const store = await loadedStore(createTestAdapter());
    let notified = 0;
    const unsubscribe = store.subscribe(() => (notified += 1));

    unsubscribe();
    store.write(accent, "green");

    expect(notified).toBe(0);
  });
});

describe("changes from outside", () => {
  it("takes over only the reported entries and saves nothing", async () => {
    const adapter = createTestAdapter({
      "test.accent": "blue",
      "test.window": { width: 1, height: 2 },
    });
    const store = await loadedStore(adapter);
    const windowBefore = store.read(windowSize);

    adapter.changeFromOutside([{ key: "test.accent", value: "green" }]);
    await settle();

    expect(store.read(accent)).toBe("green");
    expect(store.read(windowSize)).toBe(windowBefore);
    expect(adapter.saves).toEqual([]);
  });

  it("notifies subscribers once per report, with the new value already readable", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.read(accent)));

    adapter.changeFromOutside([
      { key: "test.accent", value: "green" },
      { key: "test.window", value: { width: 1, height: 2 } },
    ]);

    expect(seen).toEqual(["green"]);
  });

  it("ignores a report that equals the snapshot, and keeps returning the same object", async () => {
    const adapter = createTestAdapter({ "test.window": { width: 1, height: 2 } });
    const store = await loadedStore(adapter);
    const before = store.read(windowSize);
    let notified = 0;
    store.subscribe(() => (notified += 1));

    adapter.changeFromOutside([
      { key: "test.window", value: { width: 1, height: 2 } },
      { key: "test.accent", value: undefined },
    ]);

    expect(notified).toBe(0);
    expect(store.read(windowSize)).toBe(before);
  });

  it("ignores a report for an entry with a pending save, so an echo cannot undo it", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    let notified = 0;
    const release = adapter.holdSaves();
    store.write(accent, "newest");
    store.subscribe(() => (notified += 1));

    adapter.changeFromOutside([{ key: "test.accent", value: "older" }]);

    expect(store.read(accent)).toBe("newest");
    expect(notified).toBe(0);
    release();
    await settle();
    expect(adapter.stored.get("test.accent")).toBe("newest");
  });

  it("still takes reports for other entries while a save is pending", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    adapter.holdSaves();
    store.write(accent, "newest");

    adapter.changeFromOutside([{ key: "test.window", value: { width: 1, height: 2 } }]);

    expect(store.read(windowSize)).toEqual({ width: 1, height: 2 });
  });

  it("treats an entry as pending until its last save has finished", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    const releaseFirst = adapter.holdSaves();
    store.write(accent, "first");
    store.write(accent, "second");
    await settle();
    const releaseSecond = adapter.holdSaves();
    releaseFirst();
    await settle();

    adapter.changeFromOutside([{ key: "test.accent", value: "echo" }]);
    expect(store.read(accent)).toBe("second");

    releaseSecond();
    await settle();
    adapter.changeFromOutside([{ key: "test.accent", value: "from another tab" }]);
    expect(store.read(accent)).toBe("from another tab");
  });

  it("shows the default after an entry was removed", async () => {
    const adapter = createTestAdapter({ "test.accent": "green" });
    const store = await loadedStore(adapter);
    let notified = 0;
    store.subscribe(() => (notified += 1));

    adapter.changeFromOutside([{ key: "test.accent", value: undefined }]);

    expect(store.read(accent)).toBe("blue");
    expect(notified).toBe(1);
  });

  it("shows the default for a value that fails its schema, and leaves it stored", async () => {
    const adapter = createTestAdapter({ "test.accent": "green" });
    const store = await loadedStore(adapter);

    adapter.changeFromOutside([{ key: "test.accent", value: 5 }]);
    await settle();

    expect(store.read(accent)).toBe("blue");
    expect(adapter.stored.get("test.accent")).toBe(5);
    expect(adapter.saves).toEqual([]);
  });

  it("applies a report only to the scope it came from", async () => {
    const synced = createTestAdapter({ "test.scale": 1 });
    const device = createTestAdapter({ "test.scale": 2 });
    const store = await loadedStore(synced, device);

    synced.changeFromOutside([{ key: "test.scale", value: 9 }]);

    expect(store.read(scale)).toBe(2);
  });

  it("keeps a report that arrives during load, and notifies nobody before reading works", async () => {
    const adapter = createTestAdapter({ "test.accent": "blue" });
    const store = storeOver(adapter);
    store.subscribe(() => store.read(accent));

    const loading = store.load();
    adapter.changeFromOutside([{ key: "test.accent", value: "green" }]);
    await loading;

    expect(store.read(accent)).toBe("green");
  });

  it("takes reports again once a failed save has finished", async () => {
    const adapter = createTestAdapter();
    const store = await loadedStore(adapter);
    adapter.failSaves();
    store.write(accent, "lost");
    await settle();

    adapter.changeFromOutside([{ key: "test.accent", value: "from another tab" }]);

    expect(store.read(accent)).toBe("from another tab");
  });

  it("takes reports for a scope whose load failed", async () => {
    const adapter = createTestAdapter();
    adapter.failLoads();
    const store = await loadedStore(adapter);

    adapter.changeFromOutside([{ key: "test.accent", value: "green" }]);

    expect(store.read(accent)).toBe("green");
  });

  it("still resolves load and reports it when subscribing throws", async () => {
    const adapter: TestAdapter = {
      ...createTestAdapter({ "test.accent": "green" }),
      subscribe: () => {
        throw new Error("no events here");
      },
    };
    const { store, failures } = reportingStore(adapter);

    await expect(store.load()).resolves.toBeUndefined();

    expect(store.read(accent)).toBe("blue");
    expect(failures).toMatchObject([{ operation: "load", scope: "synced" }]);
  });
});

describe("when load fails", () => {
  it("resolves, starts that scope from defaults and reports the operation and scope once", async () => {
    const adapter = createTestAdapter({ "test.accent": "green" });
    adapter.failLoads();
    const { store, failures } = reportingStore(adapter);

    await expect(store.load()).resolves.toBeUndefined();

    expect(store.read(accent)).toBe("blue");
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ operation: "load", scope: "synced" });
    expect(failures[0]?.error).toBeInstanceOf(Error);
  });

  it("leaves the other scope's Settings intact", async () => {
    const synced = createTestAdapter({ "test.accent": "green" });
    const device = createTestAdapter({ "test.scale": 2 });
    synced.failLoads();
    const { store, failures } = reportingStore(synced, device);

    await store.load();

    expect(store.read(accent)).toBe("blue");
    expect(store.read(scale)).toBe(2);
    expect(failures.map(({ scope }) => scope)).toEqual(["synced"]);
  });

  it("writes only the entry the user changed and leaves the stored ones alone", async () => {
    const adapter = createTestAdapter({ "test.accent": "green", "test.window": "kept" });
    adapter.failLoads();
    const { store } = reportingStore(adapter);
    await store.load();

    store.write(accent, "red");
    await settle();

    expect(adapter.saves).toEqual([[{ key: "test.accent", value: "red" }]]);
    expect(adapter.stored.get("test.window")).toBe("kept");
  });

  it("writes nothing on its own, so stored values are back once storage recovers", async () => {
    const adapter = createTestAdapter({ "test.accent": "green" });
    const restore = adapter.failLoads();
    const { store } = reportingStore(adapter);
    await store.load();
    expect(store.read(accent)).toBe("blue");
    await settle();
    expect(adapter.saves).toEqual([]);

    restore();

    const restarted = await loadedStore(adapter);
    expect(restarted.read(accent)).toBe("green");
  });

  it("reports an adapter that throws instead of rejecting", async () => {
    const adapter = createTestAdapter();
    const throwing = {
      ...adapter,
      load: () => {
        throw new Error("no storage at all");
      },
    };
    const { store, failures } = reportingStore(throwing);

    await expect(store.load()).resolves.toBeUndefined();

    expect(failures).toHaveLength(1);
  });
});

describe("when save fails", () => {
  it("keeps the new value, reports the operation and scope, and does not retry", async () => {
    const synced = createTestAdapter({ "test.accent": "blue" });
    const device = createTestAdapter();
    const { store, failures } = reportingStore(synced, device);
    await store.load();
    device.failSaves();

    store.write(scale, 2);
    await settle();

    expect(store.read(scale)).toBe(2);
    expect(device.saves).toEqual([[{ key: "test.scale", value: 2 }]]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ operation: "save", scope: "device" });
  });

  it("still saves what is written after the failure", async () => {
    const adapter = createTestAdapter();
    const { store, failures } = reportingStore(adapter);
    await store.load();
    const restore = adapter.failSaves();

    store.write(accent, "lost");
    await settle();
    restore();
    store.write(accent, "kept");
    await settle();

    expect(adapter.stored.get("test.accent")).toBe("kept");
    expect(failures).toHaveLength(1);
  });

  it("shows the last value that was actually stored after a restart", async () => {
    const adapter = createTestAdapter({ "test.accent": "stored" });
    const { store } = reportingStore(adapter);
    await store.load();
    adapter.failSaves();

    store.write(accent, "never stored");
    await settle();
    expect(store.read(accent)).toBe("never stored");

    const restarted = storeOver(adapter);
    await restarted.load();
    expect(restarted.read(accent)).toBe("stored");
  });
});

describe("what onError receives", () => {
  const SECRET = "the-stored-value";
  const leaks: readonly (readonly [string, unknown])[] = [
    ["the message", new Error(`could not handle "${SECRET}"`)],
    ["the cause", new Error("failed", { cause: SECRET })],
    ["the name", Object.assign(new Error("failed"), { name: SECRET })],
    ["a thrown string", SECRET],
  ];

  function printed({ error, operation, scope }: SettingsStorageFailure): string {
    const { message, name, stack, cause } = error;
    return JSON.stringify([message, name, stack, String(cause), operation, scope]);
  }

  it.each(leaks)("holds no value from a failed load, through %s", async (_where, thrown) => {
    const adapter = createTestAdapter();
    adapter.failLoads(thrown);
    const { store, failures } = reportingStore(adapter);

    await store.load();

    expect(failures).toHaveLength(1);
    expect(printed(failures[0]!)).not.toContain(SECRET);
  });

  it.each(leaks)("holds no value from a failed save, through %s", async (_where, thrown) => {
    const adapter = createTestAdapter();
    const { store, failures } = reportingStore(adapter);
    await store.load();
    adapter.failSaves(thrown);

    store.write(accent, SECRET);
    await settle();

    expect(failures).toHaveLength(1);
    expect(printed(failures[0]!)).not.toContain(SECRET);
  });

  it("keeps the kind of error, so a report can still tell quota from a blocked storage", async () => {
    const adapter = createTestAdapter();
    const { store, failures } = reportingStore(adapter);
    await store.load();
    adapter.failSaves(Object.assign(new Error("over quota"), { name: "QuotaExceededError" }));

    store.write(accent, "green");
    await settle();

    expect(failures[0]?.error.message).toContain("QuotaExceededError");
  });

  it("does not let a throwing onError stop load", async () => {
    const failing = createTestAdapter();
    failing.failLoads();
    const store = storeOver(failing, createTestAdapter(), () => {
      throw new Error("the reporter is broken");
    });

    await expect(store.load()).resolves.toBeUndefined();

    expect(store.read(accent)).toBe("blue");
    expect(store.read(scale)).toBe(0);
  });

  it("does not let a throwing onError stop the saves after it", async () => {
    const adapter = createTestAdapter();
    const store = storeOver(adapter, createTestAdapter(), () => {
      throw new Error("the reporter is broken");
    });
    await store.load();
    const restore = adapter.failSaves();

    store.write(accent, "lost");
    await settle();
    restore();
    store.write(accent, "kept");
    await settle();

    expect(adapter.stored.get("test.accent")).toBe("kept");
  });
});
