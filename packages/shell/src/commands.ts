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

interface CommandOwner {
  readonly id: string;
  readonly commands?: readonly ShellCommand[] | undefined;
}

export const fullCommandId = (moduleId: string, commandId: string) => `${moduleId}.${commandId}`;

export function commandRegister(owners: readonly CommandOwner[]): readonly RegisteredCommand[] {
  return owners.flatMap(({ id: moduleId, commands = [] }) =>
    commands.map((command) => ({
      fullId: fullCommandId(moduleId, command.id),
      moduleId,
      command,
    })),
  );
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
  return [...duplicates, ...(await Promise.all(unique.map(kindProblem))).flat()];
}
