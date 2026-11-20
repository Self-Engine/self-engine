// The page's adapter for the `synced` scope over the Settings Port (D351, D119). It runs outside
// React, over the page's data connection, and loads before the first render: besides types it
// imports only `@self-engine/settings`, which the startup bundle holds already.

import type { ContractRouterClient } from "@orpc/contract";
import type { DataConnection } from "@self-engine/data-client";
import {
  createListeners,
  type JsonValue,
  type ReportedSettingEntry,
  sameJson,
  type SettingEntry,
  type SettingsAdapter,
} from "@self-engine/settings";
import type { settingsContract } from "../contracts/index.ts";

/** The mount name of the Port in the app's module list. */
const MOUNT = "settings";

/**
 * The part of the page's data connection the adapter uses: a `DataConnection` whose modules
 * include the Settings Port is one.
 */
export interface SettingsPortConnection extends Pick<
  DataConnection,
  "describeEntry" | "getState" | "onTablesChanged" | "subscribe"
> {
  readonly client: { readonly [MOUNT]: ContractRouterClient<typeof settingsContract> };
}

/** The rows by key. */
function byKey(rows: readonly SettingEntry[]): Map<string, JsonValue> {
  return new Map(rows.map(({ key, value }) => [key, value]));
}

/**
 * The Synced Settings in the database, through the Port mounted as `settings`.
 *
 * - `load` answers with the rows; `save` writes the batch in one Operation. Both reject when the
 *   Data Process rejects the call (D117).
 * - While someone listens, a Table Change of a table `load` reads, every return of the
 *   connection to `ready` after it was lost, and its first `ready` after a failed `load`, make it
 *   read the rows again and report what differs from what it last knew. A removed row is
 *   reported as absent. The first read after a failed `load` is reported even when nothing
 *   differs: the report is then empty.
 * - A read that overlaps a save of this adapter is dropped and repeated once no save is running,
 *   so a report is never older than the last finished save (late echoes).
 * - A read for a report that fails reports nothing; the next Table Change or reconnect reads again.
 */
export function createSettingsPortAdapter(connection: SettingsPortConnection): SettingsAdapter {
  const port = connection.client[MOUNT];
  const listeners = createListeners<readonly ReportedSettingEntry[]>(startListening);
  /** The entries as the adapter last knew them: from its last load, read or finished save. */
  let known = new Map<string, JsonValue>();
  /** Saves that started and have not finished. */
  let saving = 0;
  /** Counts every start and end of a save, so a read can tell that one overlapped it. */
  let saveEvents = 0;
  /** A read for a report is asked for and has not started. */
  let wanted = false;
  /** A read for a report runs. */
  let reading = false;
  /** The last `load` failed: the database's rows are unknown until a read succeeds. */
  let loadFailed = false;

  /** What `rows` changes against `known`, which it then replaces. */
  function takeRows(rows: readonly SettingEntry[]): ReportedSettingEntry[] {
    const next = byKey(rows);
    const changed: ReportedSettingEntry[] = [];
    for (const [key, value] of next) {
      if (!known.has(key) || !sameJson(known.get(key), value)) changed.push({ key, value });
    }
    for (const key of known.keys()) {
      if (!next.has(key)) changed.push({ key, value: undefined });
    }
    known = next;
    return changed;
  }

  /** Reads the rows and reports the difference, one read at a time, as often as was asked. */
  async function readForReport(): Promise<void> {
    wanted = true;
    if (reading) return;
    reading = true;
    try {
      // A save that runs will end with `saveEnded`, which asks again.
      while (wanted && saving === 0 && listeners.active()) {
        wanted = false;
        const before = saveEvents;
        let rows: readonly SettingEntry[];
        try {
          rows = await port.load({});
        } catch {
          // Safe to ignore: the store keeps what it has, and the next change or reconnect reads.
          continue;
        }
        if (saveEvents !== before) {
          wanted = true;
          continue;
        }
        const changed = takeRows(rows);
        // After a failed `load` the first read is reported even when nothing differs, so a
        // listener that waits for the database learns that it answers.
        const recovered = loadFailed;
        loadFailed = false;
        if (changed.length > 0 || recovered) listeners.emit(changed);
      }
    } finally {
      reading = false;
    }
  }

  function saveEnded(): void {
    saving -= 1;
    saveEvents += 1;
    if (saving === 0 && wanted) void readForReport();
  }

  function startListening(): () => void {
    let wasReady = connection.getState().status === "ready";
    const stopTables = connection.onTablesChanged((tables) => {
      const load = connection.describeEntry(MOUNT, "load");
      const reads = load?.kind === "query" ? load.reads : undefined;
      // Without the list, any change may be one of the Settings.
      if (reads === undefined || tables.some((table) => reads.includes(table))) {
        void readForReport();
      }
    });
    const stopState = connection.subscribe(() => {
      const ready = connection.getState().status === "ready";
      // The first ready answers the store's own load, unless that load failed; a later one
      // follows a lost port, while which Table Changes went unheard.
      if (ready && (wasReady || loadFailed)) void readForReport();
      if (ready) wasReady = true;
    });
    return () => {
      stopTables();
      stopState();
    };
  }

  return {
    load: async () => {
      let rows: readonly SettingEntry[];
      try {
        rows = await port.load({});
      } catch (thrown) {
        loadFailed = true;
        throw thrown;
      }
      loadFailed = false;
      known = byKey(rows);
      return rows;
    },
    save: async (entries) => {
      saving += 1;
      saveEvents += 1;
      try {
        await port.save({ entries });
        for (const { key, value } of entries) known.set(key, value);
      } finally {
        saveEnded();
      }
    },
    subscribe: listeners.add,
  };
}
