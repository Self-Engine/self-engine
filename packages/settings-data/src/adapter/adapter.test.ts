// The adapter over the Port (D351, D119), against the real core of the Data Process over real
// SQLite (D95). Each page connection reaches the test Data Process through its own port, as a
// window does; the Table Change arrives over that port. No clock: each step waits for the answer
// or the report it expects.

import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import type { TablesChanged } from "@self-engine/data-protocol";
import {
  createSettingsStore,
  defineSetting,
  type ReportedSettingEntry,
  type SettingsAdapter,
} from "@self-engine/settings";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import {
  type AdapterContractHarness,
  createTestAdapter,
  describeAdapterContract,
  settle,
} from "@self-engine/settings/testing";
import { z } from "zod";
import { afterEach, expect, test } from "vite-plus/test";
import type { settingsContract } from "../contracts/index.ts";
import { settings } from "../data/index.ts";
import { createSettingsPortAdapter, type SettingsPortConnection } from "./index.ts";

type SettingsConnection = DataConnection<{ settings: typeof settingsContract }>;

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

/** What the test lets the Data Process fail; every call of the Port checks it as it runs. */
interface Breakage {
  reads: boolean;
  writes: boolean;
  readonly writesOf: Set<string>;
}

/**
 * The Port module as the app mounts it, except that a call fails while `broken` says so. A failed
 * save fails after its writes, so the Data Process's transaction is what undoes them.
 */
function breakable(broken: Breakage): typeof settings {
  const { load, save } = settings.entries;
  return {
    ...settings,
    entries: {
      load: {
        ...load,
        run: (tx, context, input) => {
          if (broken.reads) throw new Error("The test broke reads");
          return load.run(tx, context, input);
        },
      },
      save: {
        ...save,
        run: async (tx, context, input) => {
          await save.run(tx, context, input);
          if (broken.writes || input.entries.some(({ key }) => broken.writesOf.has(key))) {
            throw new Error("The test broke writes");
          }
        },
      },
    },
  };
}

/** A test Data Process with the Port mounted, started once and closed after the test. */
function startPort(broken: Breakage = { reads: false, writes: false, writesOf: new Set() }) {
  const started = startTestDataProcess({ modules: { settings: breakable(broken) } });
  cleanups.push(async () => (await started).close());
  return started;
}

/** A page connection to `dataProcess`, as a window opens one. */
function connect(dataProcess: Promise<TestDataProcess>): SettingsConnection {
  const connection: SettingsConnection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  void dataProcess.then((started) => connection.connect(started.openPort()));
  return connection;
}

/** Resolves once `connection` hears Table Changes: a change before that reaches no window. */
function untilReady(connection: SettingsConnection): Promise<void> {
  return new Promise((resolve) => {
    if (connection.getState().status === "ready") return resolve();
    const unsubscribe = connection.subscribe(() => {
      if (connection.getState().status !== "ready") return;
      unsubscribe();
      resolve();
    });
  });
}

/** Resolves with the next report of `adapter` that names every key of `keys`. */
function nextReport(adapter: SettingsAdapter, keys: readonly string[]) {
  return new Promise<readonly ReportedSettingEntry[]>((resolve) => {
    const unsubscribe = adapter.subscribe((entries) => {
      if (!keys.every((key) => entries.some((entry) => entry.key === key))) return;
      unsubscribe();
      resolve(entries);
    });
  });
}

/** Writes `entries` beside the adapters, as another device's restore would, and announces it. */
async function writeFromOutside(
  dataProcess: TestDataProcess,
  entries: readonly ReportedSettingEntry[],
): Promise<void> {
  const spaceId = dataProcess.contextSources?.spaceId;
  if (spaceId === undefined) throw new Error("The test Data Process did not start ready");
  for (const { key, value } of entries) {
    await dataProcess.database.executeScript(
      `DELETE FROM settings WHERE key = '${key.replaceAll("'", "''")}';`,
    );
    if (value !== undefined) {
      await createSettingRows(dataProcess.database.kysely, [{ spaceId, key, value }]);
    }
  }
  dataProcess.announceTablesChanged(["settings"]);
}

describeAdapterContract("the Settings Port adapter", (): AdapterContractHarness => {
  const broken: Breakage = { reads: false, writes: false, writesOf: new Set() };
  const dataProcess = startPort(broken);
  let latest: { adapter: SettingsAdapter; connection: SettingsConnection } | undefined;
  return {
    open: () => {
      const connection = connect(dataProcess);
      latest = { adapter: createSettingsPortAdapter(connection), connection };
      return latest.adapter;
    },
    changeFromOutside: async (entries) => {
      if (latest === undefined) throw new Error("Open an adapter first");
      const reported = nextReport(
        latest.adapter,
        entries.map(({ key }) => key),
      );
      await untilReady(latest.connection);
      await writeFromOutside(await dataProcess, entries);
      await reported;
    },
    breakReads: () => {
      broken.reads = true;
      return () => {
        broken.reads = false;
      };
    },
    breakWrites: () => {
      broken.writes = true;
      return () => {
        broken.writes = false;
      };
    },
    breakWritesOf: (key) => {
      broken.writesOf.add(key);
      return () => broken.writesOf.delete(key);
    },
  };
});

test("a save through one connection is reported to a second connection", async () => {
  const dataProcess = startPort();
  const firstConnection = connect(dataProcess);
  const secondConnection = connect(dataProcess);
  const first = createSettingsPortAdapter(firstConnection);
  const second = createSettingsPortAdapter(secondConnection);
  await second.load();
  await untilReady(secondConnection);
  const reported = nextReport(second, ["appearance.accent"]);

  await first.save([{ key: "appearance.accent", value: "grape" }]);

  await expect(reported).resolves.toEqual([{ key: "appearance.accent", value: "grape" }]);
});

/** Counts steps; `reach` resolves once the count has reached the wanted number. */
function counter() {
  let count = 0;
  const waiting = new Set<() => void>();
  return {
    step() {
      count += 1;
      for (const check of waiting) check();
    },
    reach(wanted: number) {
      return new Promise<void>((resolve) => {
        const check = () => {
          if (count < wanted) return;
          waiting.delete(check);
          resolve();
        };
        waiting.add(check);
        check();
      });
    },
    count: () => count,
  };
}

/**
 * The page connection with two levers a slow Data Process would pull: Table Changes wait until
 * released, and the answer of the next `load` waits once it arrived.
 */
function slowed(connection: SettingsConnection) {
  const listeners = new Set<(tables: TablesChanged) => void>();
  let held: TablesChanged[] | undefined;
  let nextLoad: { readonly arrived: () => void; readonly answer: Promise<void> } | undefined;
  const loads = counter();
  const saves = counter();
  connection.onTablesChanged((tables) => {
    if (held === undefined) for (const listener of listeners) listener(tables);
    else held.push(tables);
  });
  const port = connection.client.settings;
  const slow: SettingsPortConnection = {
    describeEntry: (module, entry) => connection.describeEntry(module, entry),
    getState: () => connection.getState(),
    subscribe: (listener) => connection.subscribe(listener),
    onTablesChanged: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    client: {
      settings: {
        load: async (input) => {
          const lever = nextLoad;
          nextLoad = undefined;
          const rows = await port.load(input);
          lever?.arrived();
          await lever?.answer;
          loads.step();
          return rows;
        },
        save: async (input) => {
          await port.save(input);
          saves.step();
        },
      },
    },
  };
  return {
    connection: slow,
    loads,
    saves,
    holdTableChanges() {
      held = [];
      return () => {
        const late = held ?? [];
        held = undefined;
        for (const tables of late) for (const listener of listeners) listener(tables);
      };
    },
    /** The next `load` reaches the Data Process; its answer waits for the returned release. */
    holdNextLoad() {
      const arrived = Promise.withResolvers<void>();
      const answer = Promise.withResolvers<void>();
      nextLoad = { arrived: arrived.resolve, answer: answer.promise };
      return { arrived: arrived.promise, release: answer.resolve };
    },
  };
}

const accent = defineSetting({
  key: "appearance.accent",
  scope: "synced",
  default: "blue",
  schema: z.string(),
});

test("two quick writes end on the last value, though the read of a late Table Change answers late", async () => {
  const dataProcess = startPort();
  const connection = connect(dataProcess);
  await untilReady(connection);
  const slow = slowed(connection);
  const store = createSettingsStore({
    adapters: { synced: createSettingsPortAdapter(slow.connection), device: createTestAdapter() },
    onError: (failure) => {
      throw failure.error;
    },
  });
  await store.load();
  const seen: string[] = [];
  store.subscribe(() => seen.push(store.read(accent)));
  const releaseTableChanges = slow.holdTableChanges();

  store.write(accent, "first");
  await slow.saves.reach(1);
  // The Table Change of the first save arrives late; the read it starts answers with "first"
  // only after the second save finished.
  const read = slow.holdNextLoad();
  const loadsBefore = slow.loads.count();
  releaseTableChanges();
  await read.arrived;
  store.write(accent, "last");
  await slow.saves.reach(2);
  await settle();
  read.release();
  await slow.loads.reach(loadsBefore + 2);
  await settle();

  expect(seen).toEqual(["first", "last"]);
  expect(store.read(accent)).toBe("last");
});

test("after a reconnect the adapter reads the rows again and reports what changed meanwhile", async () => {
  const dataProcess = startPort();
  const connection = connect(dataProcess);
  const adapter = createSettingsPortAdapter(connection);
  await adapter.save([
    { key: "appearance.accent", value: "blue" },
    { key: "i18n.language", value: "en" },
  ]);
  await untilReady(connection);
  const reported = nextReport(adapter, ["appearance.accent"]);

  connection.disconnect();
  // Announced while no port listens: this window hears of it only through the reconnect.
  await writeFromOutside(await dataProcess, [{ key: "appearance.accent", value: "grape" }]);
  connection.connect((await dataProcess).openPort());

  await expect(reported).resolves.toEqual([{ key: "appearance.accent", value: "grape" }]);
});
