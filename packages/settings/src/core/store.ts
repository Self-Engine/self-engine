// The Settings in memory. The app loads them once before its first render and reads them
// synchronously from then on (ADR 0010).

import type { SettingEntry, SettingsAdapter } from "./adapter.ts";
import {
  type JsonValue,
  type SettingChange,
  settingChange,
  type SettingDeclaration,
  type SettingScope,
} from "./setting.ts";

export interface SettingsStore {
  /** Runs once; call it before the first render. */
  readonly load: () => Promise<void>;
  /** The stored value if it passes the schema, otherwise the default. Never writes. */
  readonly read: <T extends JsonValue>(setting: SettingDeclaration<T>) => T;
  /** Applies at once and saves in the background. Throws on an invalid value. */
  readonly write: <T extends JsonValue>(setting: SettingDeclaration<T>, value: NoInfer<T>) => void;
  /** Like `write`, for changes that belong together: all apply or none, saved as one batch. */
  readonly writeAll: (changes: readonly SettingChange[]) => void;
  /** Calls `listener` after every change. Returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

export interface SettingsStoreOptions {
  readonly adapters: Readonly<Record<SettingScope, SettingsAdapter>>;
}

const SCOPES: readonly SettingScope[] = ["synced", "device"];

function sameJson(a: JsonValue | undefined, b: JsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createSettingsStore({ adapters }: SettingsStoreOptions): SettingsStore {
  const snapshot: Record<SettingScope, Map<string, JsonValue>> = {
    synced: new Map(),
    device: new Map(),
  };
  // A schema builds a new object on every parse, and `useSyncExternalStore` needs the same one.
  const parsed = new WeakMap<object, { readonly stored: JsonValue; readonly value: JsonValue }>();
  const listeners = new Set<() => void>();
  const saves: Record<SettingScope, Promise<void>> = {
    synced: Promise.resolve(),
    device: Promise.resolve(),
  };
  let loading: Promise<void> | undefined;
  let loaded = false;

  async function loadScopes(): Promise<void> {
    await Promise.all(
      SCOPES.map(async (scope) => {
        const entries = await adapters[scope].load();
        snapshot[scope] = new Map(entries.map(({ key, value }) => [key, value]));
      }),
    );
    loaded = true;
  }

  function assertLoaded(key: string): void {
    if (!loaded) throw new Error(`Setting "${key}" was used before load resolved`);
  }

  function validated({ setting, value }: SettingChange): SettingChange {
    assertLoaded(setting.key);
    const result = setting.schema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid value for Setting "${setting.key}"`, { cause: result.error });
    }
    return { setting, value: result.data };
  }

  function saveInOrder(scope: SettingScope, entries: readonly SettingEntry[]): void {
    saves[scope] = saves[scope].then(() => adapters[scope].save(entries));
  }

  function writeAll(changes: readonly SettingChange[]): void {
    const valid = changes.map(validated);
    const changed: Record<SettingScope, Map<string, JsonValue>> = {
      synced: new Map(),
      device: new Map(),
    };
    for (const { setting, value } of valid) {
      const entries = snapshot[setting.scope];
      if (sameJson(entries.get(setting.key), value)) continue;
      entries.set(setting.key, value);
      changed[setting.scope].set(setting.key, value);
    }
    if (SCOPES.every((scope) => changed[scope].size === 0)) return;

    for (const listener of listeners) listener();
    for (const scope of SCOPES) {
      if (changed[scope].size === 0) continue;
      saveInOrder(
        scope,
        [...changed[scope]].map(([key, value]) => ({ key, value })),
      );
    }
  }

  return {
    load: () => (loading ??= loadScopes()),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    write: (setting, value) => writeAll([settingChange(setting, value)]),
    writeAll,
    read: <T extends JsonValue>(setting: SettingDeclaration<T>): T => {
      assertLoaded(setting.key);
      const stored = snapshot[setting.scope].get(setting.key);
      if (stored === undefined) return setting.default;
      const cached = parsed.get(setting);
      if (cached?.stored === stored) return cached.value as T;
      const result = setting.schema.safeParse(stored);
      const value = result.success ? result.data : setting.default;
      parsed.set(setting, { stored, value });
      return value;
    },
  };
}
