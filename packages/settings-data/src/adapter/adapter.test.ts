// The adapter over the Port (D351, D119), against the real core of the Data Process over real
// SQLite (D95). Each page connection reaches the test Data Process through its own port, as a
// window does; the Table Change arrives over that port. No clock: each step waits for the answer
// or the report it expects.

import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import type { ReportedSettingEntry, SettingsAdapter } from "@self-engine/settings";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import {
  type AdapterContractHarness,
  describeAdapterContract,
} from "@self-engine/settings/testing";
import { afterEach } from "vite-plus/test";
import type { settingsContract } from "../contracts/index.ts";
import { settings } from "../data/index.ts";
import { createSettingsPortAdapter } from "./index.ts";

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
