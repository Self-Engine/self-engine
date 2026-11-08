import type {
  JsonValue,
  ReportedSettingEntry,
  SettingEntry,
  SettingsAdapter,
} from "../core/index.ts";

export interface TestAdapter extends SettingsAdapter {
  /** What the adapter holds right now. */
  readonly stored: ReadonlyMap<string, JsonValue>;
  /** Every batch `save` received, in order, from the moment the save started. */
  readonly saves: readonly (readonly SettingEntry[])[];
  /** How many times `load` ran. */
  readonly loadCount: () => number;
  /** Saves stay unfinished until the returned function is called. */
  readonly holdSaves: () => () => void;
  /** Another writer changes the entries, and `subscribe` reports them. */
  readonly changeFromOutside: (entries: readonly ReportedSettingEntry[]) => void;
  /** Every `load` rejects with `error` until the returned function is called. */
  readonly failLoads: (error?: unknown) => () => void;
  /** Every `save` rejects with `error`, storing nothing, until the returned function is called. */
  readonly failSaves: (error?: unknown) => () => void;
}

/** An adapter in memory, for tests of everything that sits on the adapter contract. */
export function createTestAdapter(initial: Readonly<Record<string, JsonValue>> = {}): TestAdapter {
  const stored = new Map(Object.entries(initial));
  const saves: (readonly SettingEntry[])[] = [];
  let loads = 0;
  const listeners = new Set<(entries: readonly ReportedSettingEntry[]) => void>();
  let held: Promise<void> = Promise.resolve();
  let loadFailure: unknown;
  let saveFailure: unknown;

  return {
    stored,
    saves,
    loadCount: () => loads,
    holdSaves: () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      held = promise;
      return resolve;
    },
    failLoads: (error = new Error("load failed")) => {
      loadFailure = error;
      return () => {
        loadFailure = undefined;
      };
    },
    failSaves: (error = new Error("save failed")) => {
      saveFailure = error;
      return () => {
        saveFailure = undefined;
      };
    },
    load: async () => {
      loads += 1;
      if (loadFailure !== undefined) throw loadFailure;
      return [...stored].map(([key, value]) => ({ key, value }));
    },
    save: async (entries) => {
      saves.push(entries);
      await held;
      if (saveFailure !== undefined) throw saveFailure;
      for (const { key, value } of entries) stored.set(key, value);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    changeFromOutside: (entries) => {
      for (const { key, value } of entries) {
        if (value === undefined) stored.delete(key);
        else stored.set(key, value);
      }
      for (const listener of listeners) listener(entries);
    },
  };
}

/** Lets everything finish that only waits for promises, without any clock. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 32; turn += 1) await Promise.resolve();
}
