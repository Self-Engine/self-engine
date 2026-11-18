import type { ReasonDefinition, WriteKind } from "@self-engine/db/schema";
import type { z } from "zod";

/** What a rule answers for one row: a Reason it names, with the details its schema takes. */
export type RuleAnswer<Id, Definition> =
  Definition extends ReasonDefinition<infer Code, infer Details>
    ? {
        readonly code: Code;
        readonly row: Id;
        readonly field?: string;
        readonly details: z.input<Details>;
      }
    : never;

/**
 * A rule as the registry holds it, once `protectionRule` checked it against its row map. It keeps
 * the Reasons it answers with, so the page side can demand a text for each (D334), and answers
 * only with those; the registry holds every rule with the broad default.
 */
export interface RegisteredRule<
  Table extends string = string,
  Reasons extends ReasonDefinition = ReasonDefinition,
> {
  readonly table: Table;
  readonly write: WriteKind;
  readonly reasons: readonly Reasons[];
  answer(...args: never[]): Promise<readonly RuleAnswer<string, Reasons>[]>;
}

/** Every rule of a Data Process, by table and kind of write. */
export interface ProtectionRules {
  rulesFor(table: string, write: WriteKind): readonly RegisteredRule[];
}

const none: readonly RegisteredRule[] = [];

/**
 * One registry from the rules of every source: in the Data Process the modules, the rules from
 * above and the frame's reference check, asked in that order.
 */
export function protectionRules(
  sources: readonly { readonly rules?: readonly RegisteredRule[] }[],
): ProtectionRules {
  const byWrite = new Map<string, RegisteredRule[]>();
  for (const rule of sources.flatMap((source) => source.rules ?? [])) {
    const key = `${rule.write} ${rule.table}`;
    byWrite.set(key, [...(byWrite.get(key) ?? []), rule]);
  }
  return { rulesFor: (table, write) => byWrite.get(`${write} ${table}`) ?? none };
}

export const noProtectionRules: ProtectionRules = { rulesFor: () => none };
