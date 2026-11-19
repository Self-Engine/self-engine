// A local copy in front of the adapter of the database (D351). The store's `load` is answered
// from the copy, so the first render never waits for the database; the database's entries follow
// as a report, and where they differ, the database wins.

import type { ReportedSettingEntry, SettingEntry, SettingsAdapter } from "./adapter.ts";
import { reportFailure, type SettingsStorageFailure, type StorageOperation } from "./failure.ts";
import { createListeners } from "./listeners.ts";
import type { LocalSettingsAdapter } from "./local-adapter.ts";

export interface LocalCopyOptions {
  /** Where the copy lives: in the app, the local adapter of the `synced` scope. */
  readonly copy: LocalSettingsAdapter;
  /** The truth: in the desktop app, the adapter over the Settings Port. */
  readonly database: SettingsAdapter;
  /** Called for every step in the background that failed, as the store's `onError` is. */
  readonly onError: (failure: SettingsStorageFailure) => void;
}

/**
 * The Synced Settings from a local copy, with the database as the truth (D351).
 *
 * - `load` answers from the copy, so the first render never waits. The first `load` also reads
 *   the database: it reports its rows, which win where the copy differs, and moves every entry of
 *   the copy the database lacks into it. Calls that wait for the database simply stay unanswered,
 *   and the app runs on the copy. If that read fails, the next report of the database repeats it,
 *   the move included.
 * - `save` writes the database, then the copy. A failed save leaves the copy on the database's
 *   state (D117).
 * - Every report of the database is written into the copy, a removed row included, and then
 *   reported. The copy's own changes are never reported: the database is the truth.
 * - A failure in the background goes to `onError`; the app keeps running.
 */
export function createLocalCopyAdapter({
  copy,
  database,
  onError,
}: LocalCopyOptions): SettingsAdapter {
  /** The copy's entries while the first read of the database failed: the next report retries. */
  let unread: readonly SettingEntry[] | undefined;
  const listeners = createListeners<readonly ReportedSettingEntry[]>(() =>
    database.subscribe((entries) => {
      // A report after a failed first read says the database answers again: read all of it.
      const copied = unread;
      unread = undefined;
      void (copied === undefined ? take(entries) : readDatabase(copied));
    }),
  );
  /** Every write to the database, in order: the moves and the store's saves. */
  let writes: Promise<void> = Promise.resolve();
  /** Counts every start and end of a write, so a read can tell that one overlapped it. */
  let saveEvents = 0;
  let loaded = false;

  function report(operation: StorageOperation, thrown: unknown): void {
    reportFailure(onError, thrown, operation, "synced");
  }

  /** Writes the copy; a failure leaves the app running on what the store holds. */
  async function writeCopy(entries: readonly ReportedSettingEntry[]): Promise<void> {
    const present: SettingEntry[] = [];
    const removed: string[] = [];
    for (const { key, value } of entries) {
      if (value === undefined) removed.push(key);
      else present.push({ key, value });
    }
    try {
      if (present.length > 0) await copy.save(present);
      if (removed.length > 0) await copy.remove(removed);
    } catch (thrown) {
      report("save", thrown);
    }
  }

  /** Writes what the database holds into the copy, then tells the listeners. */
  async function take(entries: readonly ReportedSettingEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await writeCopy(entries);
    listeners.emit(entries);
  }

  /**
   * The first read of the database. A read that overlaps a save is repeated, so it never reports
   * a value older than the last save. It reports the rows, then moves every entry of the copy that
   * the database lacks into it, one at a time, so one that fails keeps none of the others out.
   */
  async function readDatabase(copied: readonly SettingEntry[]): Promise<void> {
    let rows: readonly SettingEntry[];
    for (;;) {
      await writes;
      const before = saveEvents;
      try {
        rows = await database.load();
      } catch (thrown) {
        unread = copied;
        report("load", thrown);
        return;
      }
      if (saveEvents === before) break;
    }
    const held = new Set(rows.map(({ key }) => key));
    // Queued before anything else can run, so a later save of the same entry comes after it.
    for (const entry of copied) {
      if (!held.has(entry.key)) void inOrder(() => database.save([entry])).catch(moveFailed);
    }
    await take(rows);
  }

  function moveFailed(thrown: unknown): void {
    report("save", thrown);
  }

  /** Runs `write` after every write to the database before it. */
  function inOrder(write: () => Promise<void>): Promise<void> {
    saveEvents += 1;
    const run = writes.then(write);
    writes = run
      .catch(() => {
        // Safe to ignore here: the caller of `inOrder` learns of the failure.
      })
      .finally(() => {
        saveEvents += 1;
      });
    return run;
  }

  return {
    load: async () => {
      // Only the first load reads the database and moves; later ones answer from the copy.
      const first = !loaded;
      loaded = true;
      let entries: readonly SettingEntry[];
      try {
        entries = await copy.load();
      } catch (thrown) {
        // The store starts from the defaults and reports this; the database still follows.
        if (first) void readDatabase([]);
        throw thrown;
      }
      if (first) void readDatabase(entries);
      return entries;
    },
    save: async (entries) => {
      await inOrder(() => database.save(entries));
      await writeCopy(entries);
    },
    subscribe: listeners.add,
  };
}
