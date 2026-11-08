import type { JsonValue } from "./setting.ts";

/** One stored Setting. */
export interface SettingEntry {
  readonly key: string;
  readonly value: JsonValue;
}

/** One entry changed from outside. A removed entry is reported as absent: `value` is `undefined`. */
export interface ReportedSettingEntry {
  readonly key: string;
  readonly value: JsonValue | undefined;
}

/** Where the entries of one scope live. Asynchronous even over `localStorage` (ADR 0010). */
export interface SettingsAdapter {
  /** All entries of the scope, also those nobody declares. */
  readonly load: () => Promise<readonly SettingEntry[]>;
  /** Applies only the changed entries, together. Every other entry stays as it is. */
  readonly save: (entries: readonly SettingEntry[]) => Promise<void>;
  /** Reports entries changed from outside, whenever that happens. Returns the unsubscribe function. */
  readonly subscribe: (listener: (entries: readonly ReportedSettingEntry[]) => void) => () => void;
}
