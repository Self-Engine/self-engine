import type { MessageDescriptor } from "@lingui/core";
import type { input as SchemaInput, output as SchemaOutput, ZodType } from "zod";
import type { WriteViewSearch } from "./routing.tsx";

/** Decides who can start a Command, see ADR 0015. */
export type CommandKind = "page" | "open" | "input";

/** The address capability, for a Command that a person starts on a page. */
export interface PageCommandContext {
  /** Writes to the page the Command was started on, and does nothing once the user has left it. */
  readonly writeSearch: WriteViewSearch;
}

export type CommandContext<Kind extends CommandKind> = Kind extends "page"
  ? PageCommandContext
  : Readonly<Record<never, never>>;

declare const checkedKind: unique symbol;

/** What a Command's file exports. Only the define functions below can make one. */
export interface CommandBody<Kind extends CommandKind> {
  readonly [checkedKind]: Kind;
  /** English plain text for a model. No person reads it, so it is not translated. */
  readonly description: string;
  readonly schema: ZodType;
  readonly run: (input: unknown, context: CommandContext<Kind>) => unknown;
}

interface CommandDefinition<Schema extends ZodType, Kind extends CommandKind> {
  readonly description: string;
  readonly schema: Schema;
  readonly run: (input: SchemaOutput<Schema>, context: CommandContext<Kind>) => unknown;
}

type Empty = Readonly<Record<never, never>>;
type AcceptsEmpty<Schema extends ZodType> =
  Empty extends SchemaInput<Schema> ? unknown : { readonly schema: never };
type RefusesEmpty<Schema extends ZodType> =
  Empty extends SchemaInput<Schema> ? { readonly schema: never } : unknown;

/** The one place where a checked definition loses its input type, so the runner can hold any. */
const checked = <Kind extends CommandKind>(definition: object) => definition as CommandBody<Kind>;

/** A Command a person starts on a page. It cannot have required input. */
export function definePageCommand<Schema extends ZodType>(
  definition: CommandDefinition<Schema, "page"> & AcceptsEmpty<Schema>,
): CommandBody<"page"> {
  return checked(definition);
}

/** A Command that needs no page. Its input is optional: people start it with an empty object. */
export function defineOpenCommand<Schema extends ZodType>(
  definition: CommandDefinition<Schema, "open"> & AcceptsEmpty<Schema>,
): CommandBody<"open"> {
  return checked(definition);
}

/** A Command with required input, which only a later agent can start until a form exists. */
export function defineInputCommand<Schema extends ZodType>(
  definition: CommandDefinition<Schema, "input"> & RefusesEmpty<Schema>,
): CommandBody<"input"> {
  return checked(definition);
}

/** Everything else about a Command arrives through `load`, and stays out of the startup bundle. */
interface CommandMetadata<Kind extends CommandKind> {
  /** Short and fixed for good. The register adds the module's id. */
  readonly id: string;
  readonly kind: Kind;
  readonly load: () => Promise<{ readonly default: CommandBody<Kind> }>;
}

interface PersonCommandMetadata<Kind extends CommandKind> extends CommandMetadata<Kind> {
  readonly label: MessageDescriptor;
  readonly defaultShortcut?: string;
}

export type PageCommand = PersonCommandMetadata<"page">;
export type OpenCommand = PersonCommandMetadata<"open">;
export interface InputCommand extends CommandMetadata<"input"> {
  readonly label?: never;
  readonly defaultShortcut?: never;
}

/** A Command that a person can start, and so a module's main action. */
export type PersonCommand = PageCommand | OpenCommand;
export type ShellCommand = PersonCommand | InputCommand;

export interface RegisteredCommand {
  /** `<module>.<command>`. Never renamed or reused: later rebinding stores shortcuts by it. */
  readonly fullId: string;
  readonly moduleId: string;
  readonly command: ShellCommand;
}

export interface CommandOwner {
  readonly id: string;
  readonly commands?: readonly ShellCommand[] | undefined;
}

export const fullCommandId = (moduleId: string, commandId: string) => `${moduleId}.${commandId}`;

/** A `page` Command needs its module on screen, so with another one showing it cannot run as is. */
export const isPageCommandElsewhere = (
  { moduleId, command }: Pick<RegisteredCommand, "moduleId" | "command">,
  activeModuleId: string | undefined,
) => command.kind === "page" && moduleId !== activeModuleId;

/** The Commands that share one key. The key is bound once, whichever module is on screen. */
export interface ShortcutKey {
  /** The first spelling the register holds for the key. */
  readonly shortcut: string;
  readonly entries: readonly RegisteredCommand[];
}

/**
 * One entry per distinct key, in the order of the register. It does not depend on the module on
 * screen, so a switch between modules leaves every binding as it is.
 */
export function shortcutKeys(
  register: readonly RegisteredCommand[],
  canonical: (shortcut: string) => string,
): readonly ShortcutKey[] {
  const keys = new Map<string, { shortcut: string; entries: RegisteredCommand[] }>();
  for (const entry of register) {
    const shortcut = entry.command.defaultShortcut;
    if (shortcut === undefined) continue;
    const key = canonical(shortcut);
    const known = keys.get(key);
    if (known) known.entries.push(entry);
    else keys.set(key, { shortcut, entries: [entry] });
  }
  return [...keys.values()];
}

/**
 * What a key starts with this module on screen, or nothing. The audit lets at most one Command
 * hold a key in any module, so the first that is not elsewhere is the only one.
 */
export const commandForKey = (
  { entries }: ShortcutKey,
  activeModuleId: string | undefined,
): RegisteredCommand | undefined =>
  entries.find((entry) => !isPageCommandElsewhere(entry, activeModuleId));

export function commandRegister(owners: readonly CommandOwner[]): readonly RegisteredCommand[] {
  return owners.flatMap(({ id: moduleId, commands = [] }) =>
    commands.map((command) => ({
      fullId: fullCommandId(moduleId, command.id),
      moduleId,
      command,
    })),
  );
}
