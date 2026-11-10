import { msg } from "@lingui/core/macro";
import { type CommandOwner, fullCommandId, type OpenCommand } from "./commands.ts";
import { RESERVED_MODULE_ID } from "./contributions.ts";

/** ⌘Z, the single exception to the reserved keys, and only outside a field (D181). */
export const UNDO_SHORTCUT = "Mod+Z";

const undo: OpenCommand = {
  id: "undo",
  kind: "open",
  label: msg`Undo`,
  defaultShortcut: UNDO_SHORTCUT,
  load: () => import("./undo-command.ts"),
};

export const UNDO_COMMAND_ID = fullCommandId(RESERVED_MODULE_ID, undo.id);

/** The Shell's own Commands, beside those of the modules. */
export const shellCommands: CommandOwner = { id: RESERVED_MODULE_ID, commands: [undo] };
