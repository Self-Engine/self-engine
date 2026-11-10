import { type CommandOwner, commandRegister, type RegisteredCommand } from "./commands.ts";
import { PALETTE_SHORTCUT, UNDO_COMMAND_ID, UNDO_SHORTCUT } from "./shell-commands.ts";

/**
 * Keys the app must not take: copy, paste, cut, select-all and undo, the Command Palette's ⌘K, and
 * what Electron's default menu holds, since the app sets no menu of its own.
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
  "Mod+-",
];

interface ValidShortcut {
  readonly entry: RegisteredCommand;
  readonly canonical: string;
}

/** A `page` shortcut holds only in its own module, an `open` one everywhere. */
const collide = (a: RegisteredCommand, b: RegisteredCommand) =>
  a.moduleId === b.moduleId || a.command.kind === "open" || b.command.kind === "open";

/** Loads the hotkey library on purpose: the check at startup stays free of it. */
async function auditShortcuts(register: readonly RegisteredCommand[]) {
  const { readShortcut } = await import("./shortcut-bindings.tsx");
  const canonical = (shortcut: string) => {
    const read = readShortcut(shortcut);
    return "canonical" in read ? read.canonical : shortcut;
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
    const read = readShortcut(shortcut);
    if ("invalid" in read) problems.push(`${name} is invalid (${read.invalid})`);
    else if (!read.hasMod) problems.push(`${name} needs Mod`);
    else if (reserved.has(read.canonical) && !mayHoldReservedKey(entry.fullId, read.canonical))
      problems.push(`${name} is reserved`);
    else valid.push({ entry, canonical: read.canonical });
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
