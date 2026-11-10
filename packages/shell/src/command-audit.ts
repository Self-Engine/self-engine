import {
  type CommandOwner,
  commandRegister,
  isPageCommandElsewhere,
  type RegisteredCommand,
} from "./commands.ts";
import { PALETTE_SHORTCUT, UNDO_COMMAND_ID, UNDO_SHORTCUT } from "./shell-commands.ts";

/**
 * Keys the app must not take: copy, paste, cut, select-all and undo, the Command Palette's ⌘K, and
 * what Electron's default menu holds, since the app sets no menu of its own. Fullscreen's ⌃⌘F is
 * not listed: on a Mac it is not `Mod` alone, so the audit already refuses it for that.
 */
const RESERVED_SHORTCUTS = [
  "Mod+C",
  "Mod+V",
  "Mod+X",
  "Mod+A",
  "Mod+Z",
  PALETTE_SHORTCUT,
  "Mod+Shift+Z",
  "Mod+Y",
  "Mod+W",
  "Mod+Q",
  "Mod+R",
  "Mod+Shift+R",
  "Mod+M",
  "Mod+H",
  "Mod+Alt+H",
  "Mod+Shift+H",
  "Mod+Shift+V",
  "Mod+Alt+Shift+V",
  "Mod+Shift+I",
  "Mod+Alt+I",
  "Mod+0",
  "Mod+=",
  // Zoom in is `CommandOrControl+Plus`: its own key on some layouts, Shift and `=` on others.
  "Mod++",
  "Mod+Shift+=",
  "Mod+-",
];

interface ValidShortcut {
  readonly entry: RegisteredCommand;
  readonly canonical: string;
}

/** Whether both hold at once: with the module of one on screen, the other is not elsewhere. */
const collide = (a: RegisteredCommand, b: RegisteredCommand) =>
  !isPageCommandElsewhere(b, a.moduleId) || !isPageCommandElsewhere(a, b.moduleId);

/** A dynamic import: the package's index exports this file, and the library stays out of startup. */
async function auditShortcuts(register: readonly RegisteredCommand[]) {
  const { readShortcut } = await import("./shortcut-bindings.tsx");
  const canonical = (shortcut: string) => {
    const parsed = readShortcut(shortcut);
    return "canonical" in parsed ? parsed.canonical : shortcut;
  };
  const reserved = new Set(RESERVED_SHORTCUTS.map(canonical));
  const undoKey = canonical(UNDO_SHORTCUT);
  const mayHoldReservedKey = (fullId: string, key: string) =>
    fullId === UNDO_COMMAND_ID && key === undoKey;
  const problems: string[] = [];
  const valid: ValidShortcut[] = [];
  for (const entry of register) {
    const shortcut = entry.command.defaultShortcut;
    if (shortcut === undefined) continue;
    const name = `${entry.fullId}: default shortcut "${shortcut}"`;
    const parsed = readShortcut(shortcut);
    if ("invalid" in parsed) problems.push(`${name} is invalid (${parsed.invalid})`);
    else if (!parsed.hasMod) problems.push(`${name} needs Mod`);
    else if (reserved.has(parsed.canonical) && !mayHoldReservedKey(entry.fullId, parsed.canonical))
      problems.push(`${name} is reserved`);
    else valid.push({ entry, canonical: parsed.canonical });
  }
  const collisions = valid.flatMap((one, index) =>
    valid
      .slice(index + 1)
      .filter((other) => other.canonical === one.canonical && collide(one.entry, other.entry))
      .map(
        (other) =>
          `Shortcut ${one.canonical} is used twice: ${one.entry.fullId} and ${other.entry.fullId}`,
      ),
  );
  return [...problems, ...collisions];
}

async function kindProblem({ fullId, command }: RegisteredCommand) {
  const { default: body } = await command.load();
  const { success: acceptsEmpty } = await body.schema.safeParseAsync({});
  if (acceptsEmpty === (command.kind !== "input")) return [];
  const needed = acceptsEmpty ? "refuses" : "accepts";
  return [`${fullId}: kind ${command.kind} needs a schema that ${needed} an empty object`];
}

/**
 * For the test over all real contributions. It loads every Command, so the app never runs it.
 * Returns each problem found, and none when the register is sound.
 */
export async function auditCommands(owners: readonly CommandOwner[]) {
  const register = commandRegister(owners);
  const seen = new Set<string>();
  const unique = register.filter(({ fullId }) => !seen.has(fullId) && seen.add(fullId));
  const duplicates = register
    .filter((entry) => !unique.includes(entry))
    .map(({ fullId }) => `Duplicate Command id: ${fullId}`);
  return [
    ...duplicates,
    ...(await Promise.all(unique.map(kindProblem))).flat(),
    ...(await auditShortcuts(unique)),
  ];
}
