import { ORPCError } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import { refusal, type Reason, type ReasonDefinition } from "@self-engine/db/schema";
import type { Transaction, Updateable } from "kysely";
import type { z } from "zod";
import type { StorageContext } from "./context.ts";
import type { ConventionKey, RowId, SyncedTable } from "./convention.ts";
import type { ReadTransaction, RowMap } from "./module.ts";
import { recordTableWrites } from "./table-writes.ts";

/** The six kinds of write of the frame's write paths; a Protection Rule guards one (D331). */
export type WriteKind = "insert" | "update" | "delete" | "restore" | "archive" | "unarchive";

/** The fields a write sets, without the convention columns the frame writes itself. */
export type WrittenValues<Row> = Readonly<Omit<Updateable<Row>, ConventionKey>>;

/** One row a rule answers for; insert and update also hand over the values being written. */
export type RuleRow<DB, Table extends keyof DB, Write extends WriteKind> = Write extends
  | "insert"
  | "update"
  ? { readonly id: RowId<DB, Table>; readonly values: WrittenValues<DB[Table]> }
  : { readonly id: RowId<DB, Table> };

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
 * A Protection Rule (D331, D333): it guards one table and one kind of write, reads through the
 * write's transaction with an access that has no write, and answers per row with the Reasons it
 * names. An empty answer lets the write through.
 */
export interface ProtectionRule<
  DB,
  Table extends SyncedTable<DB>,
  Write extends WriteKind,
  Reasons extends readonly ReasonDefinition[],
> {
  readonly table: Table;
  readonly write: Write;
  readonly reasons: Reasons;
  answer(
    tx: ReadTransaction<DB>,
    context: StorageContext,
    rows: readonly RuleRow<DB, Table, Write>[],
  ): Promise<readonly RuleAnswer<RowId<DB, Table>, Reasons[number]>[]>;
}

/** A rule as the registry holds it, once `protectionRule` checked it against its row map. */
export interface RegisteredRule<Table extends string = string> {
  readonly table: Table;
  readonly write: WriteKind;
  readonly reasons: readonly ReasonDefinition[];
  answer(...args: never[]): Promise<readonly RuleAnswer<string, ReasonDefinition>[]>;
}

/** States a rule for a table of this row map; the row map types its rows and its reads. */
export function protectionRule<
  const Rows extends RowMap,
  const Table extends SyncedTable<TablesOf<Rows>>,
  const Write extends WriteKind,
  const Reasons extends readonly ReasonDefinition[],
>(
  _rowMap: Rows,
  rule: ProtectionRule<TablesOf<Rows>, Table, Write, Reasons>,
): ProtectionRule<TablesOf<Rows>, Table, Write, Reasons> {
  return rule;
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

/**
 * Asks the rules for this table and kind of write before a write path writes, in the same
 * transaction. Without a rule it costs one lookup in memory and no query. A Reason refuses the
 * write: it throws the Refusal, which the frame passes through like "not found".
 */
export async function askRules<DB>(
  tx: Transaction<DB>,
  context: StorageContext,
  table: string,
  write: WriteKind,
  rows: readonly { readonly id: string; readonly values?: object }[],
): Promise<void> {
  const rules = context.rules.rulesFor(table, write);
  if (rules.length === 0) return;
  // The type of a rule's access already has no write; this stops a cast at runtime too.
  const reads = tx.withPlugin(recordTableWrites(new Set(), true));
  const reasons: Reason[] = [];
  for (const rule of rules) {
    // The registry erased the rule's own row types after `protectionRule` checked them.
    const answers = await (rule.answer as (...args: unknown[]) => ReturnType<typeof rule.answer>)(
      reads,
      context,
      rows,
    );
    for (const { code, row, field, details } of answers) {
      const definition = rule.reasons.find((reason) => reason.code === code);
      if (definition === undefined)
        throw new Error(`The ${write} rule of ${table} answered with an unnamed Reason: ${code}`);
      reasons.push({
        code,
        severity: "blocking",
        row,
        ...(field === undefined ? {} : { field }),
        details: definition.details.parse(details),
      });
    }
  }
  if (reasons.length > 0)
    throw new ORPCError("REFUSED", { status: refusal.REFUSED.status, data: { reasons } });
}
