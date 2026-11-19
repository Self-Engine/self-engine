import { safeParse, type $ZodType } from "zod/v4/core";

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

/**
 * One user decision: declared by its owner, with `T` inferred from the schema. `Scope` keeps the
 * declared scope, so a reader that takes only Synced Settings rejects a Device Setting at compile
 * time.
 */
export interface SettingDeclaration<
  T extends JsonValue,
  Scope extends SettingScope = SettingScope,
> {
  /** Permanent, like a Theme id, and starts with the owner's name: `appearance.accent`. */
  readonly key: string;
  readonly scope: Scope;
  readonly default: T;
  /**
   * A schema of `zod/mini`: the app reads Settings before its first render, and Zod's full build
   * may not load that early (docs/development/performance.md). The type is the one both builds
   * share, so a Setting that only code loaded on demand declares can reuse a schema of the full
   * build.
   */
  readonly schema: $ZodType<T>;
}

export function defineSetting<T extends JsonValue, const Scope extends SettingScope>(declaration: {
  readonly key: string;
  readonly scope: Scope;
  readonly default: NoInfer<T>;
  readonly schema: $ZodType<T>;
}): SettingDeclaration<T, Scope> {
  return declaration;
}

/**
 * What a Setting reads as: the stored value if it passes the schema, otherwise the default. The
 * one rule for every reader, the store in the page and the read in the Data Process.
 */
export function settingValue<T extends JsonValue>(
  setting: SettingDeclaration<T>,
  stored: unknown,
): T {
  if (stored === undefined) return setting.default;
  const result = safeParse(setting.schema, stored);
  return result.success ? result.data : setting.default;
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
