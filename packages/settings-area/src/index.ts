// The startup part of the settings area: only the id, name, icon and View titles. Everything
// else loads with `./area.tsx` when the settings are first opened.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { SettingsIcon } from "@self-engine/icons";
import type { SettingsStore } from "@self-engine/settings";
import type { ShellContribution, ShellView } from "@self-engine/shell";
import type { ShortcutOwner } from "./shortcut-rows.tsx";
import type { VersionInfo } from "./version.ts";
import { SEARCH_PARAMETER, type SettingsViewId, VIEW_IDS } from "./views.ts";

export type { SettingsRow, SettingsRowControlProps } from "./row.ts";
export type { ShortcutOwner } from "./shortcut-rows.tsx";
export type { VersionInfo } from "./version.ts";

/** What the app hands to the settings area. A later View that needs more adds a field here. */
export interface SettingsAreaInputs {
  /** The app's one store, already loaded. Every row reads and writes through it. */
  readonly store: SettingsStore;
  /**
   * Which app is running, shown on About. Read when the settings are first opened, so the app
   * can build the contribution before it has an environment to ask.
   */
  readonly version: () => VersionInfo;
  /**
   * Every Shell Contribution of the app, whose Commands with a default shortcut the View Shortcuts
   * lists; the Shell's own Commands are added by the area. Read when the settings are first
   * opened, so the list may hold the settings area itself.
   */
  readonly commandOwners: () => readonly ShortcutOwner[];
}

/**
 * The Shell Contribution `settings`, which the app hands to the Shell beside the modules. It has
 * no Commands and no main action, and its type says so.
 */
export function createSettingsArea({ store, version, commandOwners }: SettingsAreaInputs) {
  const view = (id: SettingsViewId, title: MessageDescriptor): ShellView => {
    // Remembered, because the router loads a View again on every visit and a new component
    // would throw away the state of the page.
    let page: ReturnType<ShellView["load"]> | undefined;
    return {
      id,
      title,
      load: () =>
        (page ??= import("./area.tsx").then(
          (area) => ({
            default: area.viewPage(id, {
              store,
              version: version(),
              commandOwners: commandOwners(),
              views,
            }),
          }),
          (error: unknown) => {
            // Forgotten, so that the next visit tries the load again.
            page = undefined;
            throw error;
          },
        )),
    };
  };
  const views: readonly [ShellView, ...ShellView[]] = [
    view(VIEW_IDS.appearance, msg`Appearance`),
    view(VIEW_IDS.language, msg`Language`),
    view(VIEW_IDS.shortcuts, msg`Shortcuts`),
    view(VIEW_IDS.about, msg`About`),
  ];
  return {
    id: "settings",
    name: msg`Settings`,
    icon: SettingsIcon,
    color: "grape",
    views,
    sharedSearch: [SEARCH_PARAMETER],
  } as const satisfies ShellContribution;
}
