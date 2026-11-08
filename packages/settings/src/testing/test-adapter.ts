import type { JsonValue, SettingEntry, SettingsAdapter } from "../core/index.ts";

export interface TestAdapter extends SettingsAdapter {
  /** What the adapter holds right now. */
  readonly stored: ReadonlyMap<string, JsonValue>;
  /** Every batch `save` received, in order, from the moment the save started. */
  readonly saves: readonly (readonly SettingEntry[])[];
  /** How many times `load` ran. */
  readonly loadCount: () => number;
  /** Saves stay unfinished until the returned function is called. */
  readonly holdSaves: () => () => void;
}

/** An adapter in memory, for tests of everything that sits on the adapter contract. */
export function createTestAdapter(initial: Readonly<Record<string, JsonValue>> = {}): TestAdapter {
  const stored = new Map(Object.entries(initial));
  const saves: (readonly SettingEntry[])[] = [];
  let loads = 0;
  let held: Promise<void> = Promise.resolve();

  return {
    stored,
    saves,
    loadCount: () => loads,
    holdSaves: () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      held = promise;
      return resolve;
    },
    load: async () => {
      loads += 1;
      return [...stored].map(([key, value]) => ({ key, value }));
    },
    save: async (entries) => {
      saves.push(entries);
      await held;
      for (const { key, value } of entries) stored.set(key, value);
    },
  };
}

/** Lets everything finish that only waits for promises, without any clock. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 32; turn += 1) await Promise.resolve();
}
