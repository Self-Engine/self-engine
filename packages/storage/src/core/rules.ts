import { ORPCError } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import { refusal, type Reason, type ReasonDefinition } from "@self-engine/db/schema";
import type { Transaction, Updateable } from "kysely";
import type { StorageContext } from "./context.ts";
import type { RuleAnswer, WriteKind } from "./registry.ts";
import type { ConventionKey, RowId, SyncedTable } from "./convention.ts";
import type { ReadTransaction, RowMap } from "./module.ts";
import { recordTableWrites } from "./table-writes.ts";

/** The fields a write sets, without the convention columns the frame writes itself. */
export type WrittenValues<Row> = Readonly<Omit<Updateable<Row>, ConventionKey>>;

/** One row a rule answers for; insert and update also hand over the values being written. */
export type RuleRow<DB, Table extends keyof DB, Write extends WriteKind> = Write extends
  | "insert"
  | "update"
  ? { readonly id: RowId<DB, Table>; readonly values: WrittenValues<DB[Table]> }
  : { readonly id: RowId<DB, Table> };

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
        table,
        row,
        ...(field === undefined ? {} : { field }),
        details: definition.details.parse(details),
      });
    }
  }
  if (reasons.length > 0)
    throw new ORPCError("REFUSED", { status: refusal.REFUSED.status, data: { reasons } });
}
