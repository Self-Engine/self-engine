// The only file that knows the hotkey library, which is still in beta (D179). It loads after the
// first paint, so a key pressed in the first moments is lost.

import { isConfirmationOpen } from "@self-engine/ui";
import {
  formatForDisplay,
  getHotkeyManager,
  type HotkeyChord,
  normalizeHotkey,
  useHotkeys,
  validateHotkey,
} from "@tanstack/react-hotkeys";
import { useCommandPalette } from "./command-palette-state.tsx";
import { commandForKey, commandRegister, shortcutKeys } from "./commands.ts";
import type { CommandScope } from "./palette-entries.ts";
import { PALETTE_SHORTCUT, UNDO_COMMAND_ID } from "./shell-commands.ts";
import { useStartCommand } from "./start-command.tsx";

export type ReadShortcut =
  | { readonly invalid: string }
  | { readonly canonical: string; readonly hasMod: boolean };

/** For the audit of the default shortcuts, which runs in the tests and never in the app. */
export function readShortcut(shortcut: string): ReadShortcut {
  const chord = shortcut as HotkeyChord;
  const { errors, warnings } = validateHotkey(chord);
  const [issue] = [...errors, ...warnings];
  if (issue !== undefined) return { invalid: issue.reason };
  const onMac = normalizeHotkey(chord, "mac");
  // `Meta` is `Mod` only on a Mac and `Control` only elsewhere, so `Mod` has to hold on both.
  return { canonical: onMac, hasMod: [onMac, normalizeHotkey(chord, "windows")].every(startsMod) };
}

/** Two spellings of one key on this platform give the same string. */
const sameKeyAs = (shortcut: string) => normalizeHotkey(shortcut as HotkeyChord);

const startsMod = (chord: string) => chord.startsWith("Mod+");

/** ⌘K on macOS, Ctrl+K elsewhere. */
export const displayShortcut = (shortcut: string) =>
  // The library's macOS notation puts a space between the symbols.
  formatForDisplay(shortcut as HotkeyChord).replaceAll(" ", "");

/** For the stories: which bindings are registered now, so they can tell when one is replaced. */
export const registeredBindingIds = () => [...getHotkeyManager().registrations.state.keys()];

export function ShortcutBindings({ owners, activeModuleId }: CommandScope) {
  const start = useStartCommand();
  const palette = useCommandPalette();
  const quiet = () => isConfirmationOpen() || palette.isOpen();
  useHotkeys(
    [
      {
        hotkey: PALETTE_SHORTCUT,
        callback: () => {
          if (!quiet()) palette.open();
        },
      },
      // One binding per key. Navigating keeps the list as it is, so the library only swaps the
      // callbacks and options in place and registers nothing anew.
      ...shortcutKeys(commandRegister(owners), sameKeyAs).map((key) => {
        const entry = commandForKey(key, activeModuleId);
        return {
          hotkey: key.shortcut as HotkeyChord,
          callback: () => {
            if (entry !== undefined && !quiet()) void start(entry.moduleId, entry.command);
          },
          options: {
            // Without a Command for it on screen, the key is left to the browser.
            enabled: entry !== undefined,
            // In a field ⌘Z stays with the text. It is the one shortcut that does not work there.
            ...(key.entries.some(({ fullId }) => fullId === UNDO_COMMAND_ID) && {
              ignoreInputs: true,
            }),
          },
        };
      }),
    ],
    // Every default shortcut has `Mod`, so typing cannot reach one, and it also works in a field.
    { ignoreInputs: false, requireReset: true },
  );
  return null;
}
