import { useSyncExternalStore } from "react";
import type { JsonValue, SettingDeclaration, SettingsStore } from "../core/index.ts";

/** The current value of a Setting; rerenders when it changes. Needs a loaded store. */
export function useSetting<T extends JsonValue>(
  store: SettingsStore,
  setting: SettingDeclaration<T>,
): T {
  return useSyncExternalStore(store.subscribe, () => store.read(setting));
}
