import type { z } from "zod";

/** What an entry can hold. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Synced Settings can follow the user between devices, Device Settings stay on one device. */
export type SettingScope = "synced" | "device";

/** One user decision: declared by its owner, with `T` inferred from the schema. */
export interface SettingDeclaration<T extends JsonValue> {
  /** Permanent, like a Theme id, and starts with the owner's name: `appearance.accent`. */
  readonly key: string;
  readonly scope: SettingScope;
  readonly default: T;
  readonly schema: z.ZodType<T>;
}

export function defineSetting<T extends JsonValue>(declaration: {
  readonly key: string;
  readonly scope: SettingScope;
  readonly default: NoInfer<T>;
  readonly schema: z.ZodType<T>;
}): SettingDeclaration<T> {
  return declaration;
}

/** A value for one Setting, typed against it. `writeAll` takes a list of these. */
export interface SettingChange {
  readonly setting: SettingDeclaration<JsonValue>;
  readonly value: JsonValue;
}

export function settingChange<T extends JsonValue>(
  setting: SettingDeclaration<T>,
  value: NoInfer<T>,
): SettingChange {
  return { setting, value };
}
