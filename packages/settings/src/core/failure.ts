import type { SettingScope } from "./setting.ts";

export type StorageOperation = "load" | "save" | "subscribe";

/** One operation an adapter could not carry out. Never holds a Setting's value. */
export interface SettingsStorageFailure {
  /** Built by `storageFailure` and names only the kind of error. */
  readonly error: Error;
  readonly operation: StorageOperation;
  readonly scope: SettingScope;
}

/**
 * The failure to report for `thrown`. What an adapter throws can quote the value it was handling,
 * in its message, stack or cause, as `JSON.parse` does. Only the error's name passes on, and only
 * if it looks like one.
 */
export function storageFailure(
  thrown: unknown,
  operation: StorageOperation,
  scope: SettingScope,
): SettingsStorageFailure {
  const kind = thrown instanceof Error && /^\w+Error$/.test(thrown.name) ? thrown.name : "Error";
  const error = new Error(`Settings ${operation} failed in scope "${scope}": ${kind}`);
  return { error, operation, scope };
}
