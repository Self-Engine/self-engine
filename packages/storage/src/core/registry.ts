import type { ReasonDefinition } from "@self-engine/db/schema";
import type { z } from "zod";

/** The six kinds of write of the frame's write paths; a Protection Rule guards one (D331). */
export type WriteKind = "insert" | "update" | "delete" | "restore" | "archive" | "unarchive";

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

/** A rule as the registry holds it, once `protectionRule` checked it against its row map. */
export interface RegisteredRule<Table extends string = string> {
  readonly table: Table;
  readonly write: WriteKind;
  readonly reasons: readonly ReasonDefinition[];
  answer(...args: never[]): Promise<readonly RuleAnswer<string, ReasonDefinition>[]>;
}

/** Every rule of a Data Process, by table and kind of write. */
export interface ProtectionRules {
  rulesFor(table: string, write: WriteKind): readonly RegisteredRule[];
}

const none: readonly RegisteredRule[] = [];

/** One registry from the rules of every module (and later of the frame and from above). */
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
