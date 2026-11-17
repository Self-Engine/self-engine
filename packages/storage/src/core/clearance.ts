import type { Clearance, ClearanceWrite, Reason, RowClearance } from "@self-engine/db/schema";
import type { Transaction } from "kysely";
import type { StorageContext } from "./context.ts";
import { answerRules, findsRow, rowsFound } from "./rules.ts";

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
  // The lookup only reads, and `answerRules` hands the rules an access that throws on a write.
  const found = await rowsFound(tx, context, table, asked);
  const answers = new Map(
    asked.map((id) => [id, {} as Partial<Record<ClearanceWrite, Clearance>>]),
  );
  for (const write of new Set(writes)) {
    const rows = asked.filter((id) => findsRow(write, found.get(id)));
    const reasons =
      rows.length === 0
        ? []
        : await answerRules(
            tx,
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
