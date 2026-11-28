import { ORPCError } from "@orpc/server";
import { notFound } from "./not-found.ts";
import type { TablesOf } from "@self-engine/db";
import {
  refusal,
  type Reason,
  type ReasonDefinition,
  type WriteKind,
} from "@self-engine/db/schema";
import type { Kysely, Transaction, Updateable } from "kysely";
import type { StorageContext } from "./context.ts";
import type { RuleAnswer } from "./registry.ts";
import type { Archivable, Convention, ConventionKey, RowId, SyncedTable } from "./convention.ts";
import type { ReadTransaction, RowMap } from "./module.ts";
import { partsOfLiveOwners } from "./part-rows.ts";
import { recordTableWrites } from "./table-writes.ts";

/** The fields a write sets, without the convention columns the frame writes itself. */
export type WrittenValues<Row> = Readonly<Omit<Updateable<Row>, ConventionKey>>;

/**
 * One row a rule answers for; insert and update also hand over the values being written, and a
 * restore those written with it, if any (D371). A field a restore leaves out keeps its stored
 * value, which a rule reads itself.
 */
export type RuleRow<DB, Table extends keyof DB, Write extends WriteKind> = Write extends
  | "insert"
  | "update"
  ? { readonly id: RowId<DB, Table>; readonly values: WrittenValues<DB[Table]> }
  : Write extends "restore"
    ? { readonly id: RowId<DB, Table>; readonly values?: WrittenValues<DB[Table]> }
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
 * write: it throws the Refusal, which the frame passes through like "not found". A write that
 * would not find its row answers "not found" whatever a rule says, and an archive or unarchive
 * that would change nothing writes nothing a rule could guard, so its Reasons fall away; only a
 * refused write pays the one lookup by primary key that tells.
 */
export async function askRules<DB>(
  tx: Transaction<DB>,
  context: StorageContext,
  table: string,
  write: WriteKind,
  rows: readonly { readonly id: string; readonly values?: object }[],
): Promise<void> {
  let reasons = await answerRules(tx, context, table, write, rows);
  if (reasons.length === 0) return;
  if (write !== "insert") {
    const found = await rowsFound(
      tx,
      context,
      table,
      rows.map(({ id }) => id),
      isArchiveWrite(write),
    );
    if (rows.some(({ id }) => !findsRow(write, found.get(id)))) throw notFound();
    reasons = reasons.filter(({ row }) => changesRow(write, found.get(row)));
    if (reasons.length === 0) return;
  }
  throw new ORPCError("REFUSED", { status: refusal.REFUSED.status, data: { reasons } });
}

/** A row of the Space as the lookup found it; `archived` is read only for archive and unarchive. */
export interface FoundRow {
  readonly deleted: boolean;
  readonly archived: boolean;
}

export function isArchiveWrite(write: WriteKind): write is "archive" | "unarchive" {
  return write === "archive" || write === "unarchive";
}

/**
 * Whether these rows of the Space exist, by id, whether each is deleted and, on an archivable
 * table when asked, whether it is archived: one lookup. A Part Row of a deleted owner is not
 * found for any write (ADR 0042).
 */
export async function rowsFound<DB>(
  tx: Transaction<DB>,
  context: StorageContext,
  table: string,
  ids: readonly string[],
  archivable = false,
): Promise<ReadonlyMap<string, FoundRow>> {
  // The caller checked that the table is synced; its convention columns are the frame's own, and
  // it asks for `archived_at` only on a table that has it.
  const found = await (tx as unknown as Kysely<Record<string, Convention & Archivable>>)
    .selectFrom(table)
    .select(archivable ? ["id", "deleted_at", "archived_at"] : ["id", "deleted_at"])
    .where("space_id", "=", context.spaceId)
    .where("id", "in", ids)
    .$call(partsOfLiveOwners(context.parts, table))
    .execute();
  return new Map(
    found.map((row) => [
      row.id,
      {
        deleted: row.deleted_at !== null,
        archived: "archived_at" in row && row.archived_at !== null,
      },
    ]),
  );
}

/** A restore finds a deleted row; every other write on an existing row a Live Row. */
export function findsRow(write: Exclude<WriteKind, "insert">, found: FoundRow | undefined) {
  return found !== undefined && found.deleted === (write === "restore");
}

/**
 * Whether a write would change the row it finds: archive and unarchive change only a row whose
 * state differs (D327); every other write changes it.
 */
export function changesRow(write: Exclude<WriteKind, "insert">, found: FoundRow | undefined) {
  if (!isArchiveWrite(write) || found === undefined) return true;
  return found.archived !== (write === "archive");
}

/**
 * Every Reason the rules for this table and kind of write answer for these rows, each checked
 * against the definition its rule names and given the table. The write paths throw them as a
 * Refusal; the Clearance answers with them.
 */
export async function answerRules<DB>(
  tx: Transaction<DB>,
  context: StorageContext,
  table: string,
  write: WriteKind,
  rows: readonly { readonly id: string; readonly values?: object }[],
): Promise<Reason[]> {
  const rules = context.rules.rulesFor(table, write);
  if (rules.length === 0) return [];
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
  return reasons;
}
