// The page's adapter for the `synced` scope over the Settings Port (D351, D119). It runs outside
// React, over the page's data connection, and loads before the first render: it imports types
// only, so the startup bundle gains this file and nothing else.

import type { ContractRouterClient } from "@orpc/contract";
import type { DataConnection } from "@self-engine/data-client";
import type {
  JsonValue,
  ReportedSettingEntry,
  SettingEntry,
  SettingsAdapter,
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

function sameJson(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The Synced Settings in the database, through the Port mounted as `settings`.
 *
 * - `load` answers with the rows; `save` writes the batch in one Operation. Both reject when the
 *   Data Process rejects the call (D117).
 * - While someone listens, a Table Change of a table `load` reads, and every return of the
 *   connection to `ready` after it was lost, makes it read the rows again and report what differs
 *   from what it last knew. A removed row is reported as absent.
 * - A read that overlaps a save of this adapter is dropped and repeated once no save is running,
 *   so a report is never older than the last finished save (late echoes).
 * - A read for a report that fails reports nothing; the next Table Change or reconnect reads again.
 */
export function createSettingsPortAdapter(connection: SettingsPortConnection): SettingsAdapter {
  const port = connection.client[MOUNT];
  const listeners = new Set<(entries: readonly ReportedSettingEntry[]) => void>();
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
  let stopListening: (() => void) | undefined;

  function report(entries: readonly ReportedSettingEntry[]): void {
    for (const listener of listeners) listener(entries);
  }

  /** What `rows` changes against `known`, which it then replaces. */
  function takeRows(rows: readonly SettingEntry[]): ReportedSettingEntry[] {
    const next = new Map(rows.map(({ key, value }) => [key, value]));
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
      while (wanted && saving === 0 && listeners.size > 0) {
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
        if (changed.length > 0) report(changed);
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
      // The first ready answers the store's own load; a later one follows a lost port, while
      // which Table Changes went unheard.
      if (ready && wasReady) void readForReport();
      if (ready) wasReady = true;
    });
    return () => {
      stopTables();
      stopState();
    };
  }

  return {
    load: async () => {
      const rows = await port.load({});
      known = new Map(rows.map(({ key, value }) => [key, value]));
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
    subscribe: (listener) => {
      // A wrapper per subscription, so the same function subscribed twice stops one at a time.
      const entry = (entries: readonly ReportedSettingEntry[]) => listener(entries);
      listeners.add(entry);
      stopListening ??= startListening();
      return () => {
        listeners.delete(entry);
        if (listeners.size > 0) return;
        stopListening?.();
        stopListening = undefined;
      };
    },
  };
}
