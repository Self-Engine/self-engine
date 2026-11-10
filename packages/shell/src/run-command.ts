import type { CommandBody, CommandContext, CommandKind } from "./commands.ts";

export type CommandResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: unknown };

/**
 * Loads a Command, validates its input, runs it and says how it went. It shows nothing and guards
 * nothing, so a later agent can use it directly and two calls in a row both run.
 */
export async function runCommand<Kind extends CommandKind>(
  command: { readonly load: () => Promise<{ readonly default: CommandBody<Kind> }> },
  input: unknown,
  context: CommandContext<Kind>,
): Promise<CommandResult> {
  try {
    const { default: body } = await command.load();
    const parsed = await body.schema.safeParseAsync(input);
    if (!parsed.success) return { ok: false, error: parsed.error };
    return { ok: true, value: await body.run(parsed.data, context) };
  } catch (error) {
    return { ok: false, error };
  }
}
