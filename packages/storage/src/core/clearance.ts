import type { Reason } from "@self-engine/db/schema";
import type { Kysely, Transaction } from "kysely";
import type { StorageContext } from "./context.ts";
import type { Convention } from "./convention.ts";
import type { WriteKind } from "./registry.ts";
import { answerRules } from "./rules.ts";
import { recordTableWrites } from "./table-writes.ts";

/** The kinds of write on an existing row; an insert has no row to ask about yet (D339). */
export type ClearanceWrite = Exclude<WriteKind, "insert">;

/** What one kind of write would meet for one row. */
export type Clearance =
  | { readonly state: "free" }
  | { readonly state: "blocked"; readonly reasons: Reason[] }
  | { readonly state: "notFound" };

export interface RowClearance {
  readonly row: string;
  readonly writes: Partial<Record<ClearanceWrite, Clearance>>;
}

/**
 * The Clearance (D339): which of these kinds of write the rules block for these rows of a synced
 * table, and why, without writing. It looks the rows up once, then asks the rules of each kind of
 * write once, for every row the write would find: a Live Row, or a deleted one for a restore. A
 * row the write would not find is told apart from a free one, and no rule is asked for it. An
 * update is asked without values, so a rule that needs them, such as the reference check, answers
 * only at the write. One answer per asked row, in the order asked.
 */
export async function clearance<DB>(
  tx: Transaction<DB>,
  context: StorageContext,
  table: string,
  writes: readonly ClearanceWrite[],
  ids: readonly string[],
): Promise<RowClearance[]> {
  const asked = [...new Set(ids)];
  // Like a Query's access, it throws on a write, so the Clearance never writes.
  const reads = tx.withPlugin(recordTableWrites(new Set(), true));
  // The caller checked that the table is synced; its convention columns are the frame's own.
  const found = await (reads as unknown as Kysely<Record<string, Convention>>)
    .selectFrom(table)
    .select(["id", "deleted_at"])
    .where("space_id", "=", context.spaceId)
    .where("id", "in", asked)
    .execute();
  const deleted = new Map(found.map((row) => [row.id, row.deleted_at !== null]));
  const answers = new Map(
    asked.map((id) => [id, {} as Partial<Record<ClearanceWrite, Clearance>>]),
  );
  for (const write of new Set(writes)) {
    const rows = asked.filter((id) => deleted.get(id) === (write === "restore"));
    const reasons =
      rows.length === 0
        ? []
        : await answerRules(
            reads,
            context,
            table,
            write,
            rows.map((id) => (write === "update" ? { id, values: {} } : { id })),
          );
    const byRow = new Map<string, Reason[]>();
    for (const reason of reasons) {
      const own = byRow.get(reason.row);
      if (own === undefined) byRow.set(reason.row, [reason]);
      else own.push(reason);
    }
    const findable = new Set(rows);
    for (const [id, answer] of answers) {
      const own = byRow.get(id);
      answer[write] = !findable.has(id)
        ? { state: "notFound" }
        : own === undefined
          ? { state: "free" }
          : { state: "blocked", reasons: own };
    }
  }
  return asked.map((row) => ({ row, writes: answers.get(row) ?? {} }));
}
