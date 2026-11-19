// The store over a local copy in front of the database (D351), as the app composes it for the
// `synced` scope. The copy and the database are test adapters, so each test decides when the
// database answers.

import { expect, it } from "vite-plus/test";
import { z } from "zod/mini";
import {
  createTestAdapter,
  describeAdapterContract,
  settle,
  type TestAdapter,
} from "../testing/index.ts";
import { createLocalCopyAdapter, createSettingsStore, defineSetting } from "./index.ts";

const accent = defineSetting({
  key: "test.accent",
  scope: "synced",
  default: "blue",
  schema: z.string(),
});

function storeOver(copy: TestAdapter, database: TestAdapter) {
  const failures: string[] = [];
  const onError = ({ operation }: { readonly operation: string }) => failures.push(operation);
  const store = createSettingsStore({
    adapters: {
      synced: createLocalCopyAdapter({ copy, database, onError }),
      device: createTestAdapter(),
    },
    onError,
  });
  return { store, failures };
}

it("reads the first values from the copy before the database answers", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "grape" });
  database.holdLoads();
  const { store } = storeOver(copy, database);

  await store.load();

  expect(store.read(accent)).toBe("green");
});

it("ends on the database's value where the copy differs, and the copy follows", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "grape" });
  const answer = database.holdLoads();
  const { store } = storeOver(copy, database);
  await store.load();
  const seen: string[] = [];
  store.subscribe(() => seen.push(store.read(accent)));

  answer();
  await settle();

  expect(seen).toEqual(["grape"]);
  expect(copy.stored.get("test.accent")).toBe("grape");
});

it("writes the copy after a save succeeded, and leaves it after a save failed", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "green" });
  const { store, failures } = storeOver(copy, database);
  await store.load();
  await settle();

  store.write(accent, "grape");
  await settle();
  const restore = database.failSaves();
  store.write(accent, "orange");
  await settle();
  restore();

  expect(store.read(accent)).toBe("orange");
  expect(copy.stored.get("test.accent")).toBe("grape");
  expect(failures).toEqual(["save"]);
});

it("moves the entries the database lacks into it, and leaves the ones it holds", async () => {
  const copy = createTestAdapter({ "test.accent": "green", "test.language": "de" });
  const database = createTestAdapter({ "test.accent": "grape" });
  const { store } = storeOver(copy, database);

  await store.load();
  await settle();

  expect(database.saves).toEqual([[{ key: "test.language", value: "de" }]]);
  expect(Object.fromEntries(database.stored)).toEqual({
    "test.accent": "grape",
    "test.language": "de",
  });
  expect(store.read(accent)).toBe("grape");
  expect(Object.fromEntries(copy.stored)).toEqual(Object.fromEntries(database.stored));
});

it("moves nothing once the database holds every entry of the copy", async () => {
  const copy = createTestAdapter({ "test.accent": "green", "test.language": "de" });
  const database = createTestAdapter({});
  await storeOver(copy, database).store.load();
  await settle();
  const movedBefore = database.saves.length;

  await storeOver(copy, database).store.load();
  await settle();

  expect(movedBefore).toBe(2);
  expect(database.saves).toHaveLength(2);
});

it("ends on the last of two quick writes while the first read of the database answers late", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "grape" });
  const answer = database.holdLoads();
  const { store } = storeOver(copy, database);
  await store.load();

  store.write(accent, "first");
  store.write(accent, "last");
  await settle();
  // The read started before the writes and answers with what the database held then.
  answer();
  await settle();

  expect(store.read(accent)).toBe("last");
  expect(database.stored.get("test.accent")).toBe("last");
  expect(copy.stored.get("test.accent")).toBe("last");
});

it("stays on the copy while the database never answers", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "grape" });
  database.holdLoads();
  database.holdSaves();
  const { store, failures } = storeOver(copy, database);

  await store.load();
  store.write(accent, "orange");
  await settle();

  expect(store.read(accent)).toBe("orange");
  expect(copy.stored.get("test.accent")).toBe("green");
  expect(failures).toEqual([]);
});

it("stays on the copy and reports the failure when the database cannot be read", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "grape" });
  database.failLoads();
  const { store, failures } = storeOver(copy, database);

  await store.load();
  await settle();

  expect(store.read(accent)).toBe("green");
  expect(database.saves).toEqual([]);
  expect(failures).toEqual(["load"]);
});

it("reads the database again, and moves, once it reports after a failed first read", async () => {
  const copy = createTestAdapter({ "test.accent": "green", "test.language": "de" });
  const database = createTestAdapter({ "test.accent": "grape" });
  const repair = database.failLoads();
  const { store, failures } = storeOver(copy, database);
  await store.load();
  await settle();

  repair();
  database.changeFromOutside([{ key: "test.theme", value: "dark" }]);
  await settle();

  expect(store.read(accent)).toBe("grape");
  expect(Object.fromEntries(database.stored)).toEqual({
    "test.accent": "grape",
    "test.language": "de",
    "test.theme": "dark",
  });
  expect(Object.fromEntries(copy.stored)).toEqual(Object.fromEntries(database.stored));
  expect(failures).toEqual(["load"]);
});

it("ends on the database's values when the copy cannot be read", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  copy.failLoads();
  const database = createTestAdapter({ "test.accent": "grape" });
  const { store, failures } = storeOver(copy, database);

  await store.load();
  await settle();

  expect(store.read(accent)).toBe("grape");
  expect(copy.stored.get("test.accent")).toBe("grape");
  expect(failures).toEqual(["load"]);
});

it("reports what the database reports later and writes it into the copy", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "green" });
  const { store } = storeOver(copy, database);
  await store.load();
  await settle();

  database.changeFromOutside([{ key: "test.accent", value: "grape" }]);
  await settle();

  expect(store.read(accent)).toBe("grape");
  expect(copy.stored.get("test.accent")).toBe("grape");
});

it("forgets in the copy an entry the database no longer holds", async () => {
  const copy = createTestAdapter({ "test.accent": "green" });
  const database = createTestAdapter({ "test.accent": "green" });
  const { store } = storeOver(copy, database);
  await store.load();
  await settle();

  database.changeFromOutside([{ key: "test.accent", value: undefined }]);
  await settle();

  expect(store.read(accent)).toBe("blue");
  expect(copy.stored.has("test.accent")).toBe(false);
});

describeAdapterContract("a local copy in front of the database", () => {
  const copy = createTestAdapter();
  const database = createTestAdapter();
  return {
    open: () => createLocalCopyAdapter({ copy, database, onError: () => {} }),
    changeFromOutside: async (entries) => {
      database.changeFromOutside(entries);
      await settle();
    },
    breakReads: () => {
      const repairCopy = copy.failLoads();
      const repairDatabase = database.failLoads();
      return () => {
        repairCopy();
        repairDatabase();
      };
    },
    breakWrites: () => database.failSaves(),
    // The test adapter saves a batch in one step, so one failing entry fails all of it.
    breakWritesOf: () => database.failSaves(),
  };
});
