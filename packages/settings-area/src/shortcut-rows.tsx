// The rows of the View Shortcuts, which only display (D203). They are produced from the Command
// register, so a new module's Shortcuts appear without a change here.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import {
  type CommandOwner,
  commandRegister,
  PALETTE_SHORTCUT,
  shellCommands,
  ShortcutHint,
} from "@self-engine/shell";
import type { SettingsRow } from "./row.ts";
import { VIEW_IDS } from "./views.ts";

/** A Command owner the list can name: its Shortcuts stand under that name. */
export interface NamedCommandOwner extends CommandOwner {
  readonly name: MessageDescriptor;
}

/** What finds every Shortcut, besides the name of its Command. */
const SEARCH_WORDS = [msg`Shortcut`, msg`Keyboard`, msg`Key combination`];

/** The notation is the Shell's hint, which appears once the hotkey library has loaded. */
function shownShortcut(shortcut: string) {
  return function ShownShortcut() {
    return <ShortcutHint shortcut={shortcut} />;
  };
}

const shortcutRow = (
  id: string,
  group: MessageDescriptor,
  title: MessageDescriptor,
  shortcut: string,
): SettingsRow => ({
  id: `shortcut-${id}`,
  view: VIEW_IDS.shortcuts,
  group,
  title,
  searchWords: SEARCH_WORDS,
  values: [],
  control: shownShortcut(shortcut),
});

/**
 * One row per Shortcut: ⌘K, which is not a Command, then every Command with a default shortcut,
 * the Shell's own as "General" before those of the named owners. A Command without one is left out
 * until Shortcuts can be rebound (D75).
 */
export function shortcutRows(commandOwners: readonly NamedCommandOwner[]): readonly SettingsRow[] {
  const general = msg({ message: "General", context: "Shortcuts that belong to no module" });
  const groups = new Map<string, MessageDescriptor>([
    [shellCommands.id, general],
    ...commandOwners.map(({ id, name }) => [id, name] as const),
  ]);
  return [
    shortcutRow("command-palette", general, msg`Open the Command Palette`, PALETTE_SHORTCUT),
    ...commandRegister([shellCommands, ...commandOwners]).flatMap(({ fullId, moduleId, command }) => {
      const group = groups.get(moduleId);
      if (command.kind === "input" || command.defaultShortcut === undefined || !group) return [];
      return [shortcutRow(fullId, group, command.label, command.defaultShortcut)];
    }),
  ];
}
