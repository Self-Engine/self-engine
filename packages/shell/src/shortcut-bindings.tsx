// The only file that knows the hotkey library, which is still in beta (D179). It loads after the
// first paint, so a key pressed in the first moments is lost.

import { isConfirmationOpen } from "@self-engine/ui";
import {
  type HotkeyChord,
  normalizeHotkey,
  useHotkeys,
  validateHotkey,
} from "@tanstack/react-hotkeys";
import { commandRegister, type CommandOwner, type RegisteredCommand } from "./commands.ts";
import { useStartCommand } from "./start-command.tsx";

export type ReadShortcut =
  | { readonly invalid: string }
  | { readonly canonical: string; readonly hasMod: boolean };

/** For the audit of the default shortcuts, which runs in the tests and never in the app. */
export function readShortcut(shortcut: string): ReadShortcut {
  const hotkey = shortcut as HotkeyChord;
  const { errors, warnings } = validateHotkey(hotkey);
  const [issue] = [...errors, ...warnings];
  if (issue !== undefined) return { invalid: issue.reason };
  const onMac = normalizeHotkey(hotkey, "mac");
  // `Meta` is `Mod` only on a Mac and `Control` only elsewhere, so `Mod` has to hold on both.
  return { canonical: onMac, hasMod: [onMac, normalizeHotkey(hotkey, "windows")].every(startsMod) };
}

const startsMod = (hotkey: string) => hotkey.startsWith("Mod+");

/** The one place that says which key starts a Command. Later rebinding looks it up here by id. */
const shortcutOf = ({ command }: RegisteredCommand) => command.defaultShortcut;

export interface ShortcutBindingsProps {
  readonly owners: readonly CommandOwner[];
  readonly activeModuleId: string | undefined;
}

export function ShortcutBindings({ owners, activeModuleId }: ShortcutBindingsProps) {
  const start = useStartCommand();
  useHotkeys(
    commandRegister(owners).flatMap((entry) => {
      const { moduleId, command } = entry;
      const shortcut = shortcutOf(entry);
      if (shortcut === undefined || command.kind === "input") return [];
      if (command.kind === "page" && moduleId !== activeModuleId) return [];
      return {
        hotkey: shortcut as HotkeyChord,
        callback: () => {
          if (!isConfirmationOpen()) void start(moduleId, command);
        },
      };
    }),
    // Every default shortcut has `Mod`, so typing cannot reach one, and it also works in a field.
    { ignoreInputs: false, requireReset: true },
  );
  return null;
}
