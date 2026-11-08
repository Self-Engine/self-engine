import type { JsonValue } from "./setting.ts";

/** One stored Setting. */
export interface SettingEntry {
  readonly key: string;
  readonly value: JsonValue;
}

/** Where the entries of one scope live. Asynchronous even over `localStorage` (ADR 0010). */
export interface SettingsAdapter {
  /** All entries of the scope, also those nobody declares. */
  readonly load: () => Promise<readonly SettingEntry[]>;
  /** Applies only the changed entries, together. Every other entry stays as it is. */
  readonly save: (entries: readonly SettingEntry[]) => Promise<void>;
}
