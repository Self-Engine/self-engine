import type { Reference } from "@self-engine/db";
import { referenced } from "@self-engine/db/schema";
import type { Transaction } from "kysely";
import type { StorageContext } from "./context.ts";
import type { RegisteredRule, RuleAnswer } from "./registry.ts";

/** The read access of a rule over tables the frame knows only by name. */
type Untyped = Transaction<Record<string, Record<string, string | null>>>;

/**
 * The reference check, the Protection Rule the frame brings itself (D337, D338): no Live Row
 * refers to a deleted row. It is built once from the references the Data Process read at its
 * start, so no module writes code for it and no lower module learns of an upper one. Every
 * reference protects its target; an archived row is a Live Row.
 */
export function referenceCheck(references: readonly Reference[]): {
  readonly rules: readonly RegisteredRule[];
} {
  const targets = [...new Set(references.map(({ target }) => target))];
  return {
    rules: targets.map((target) =>
      deleteRule(
        target,
        references.filter((reference) => reference.target === target),
      ),
    ),
  };
}

/**
 * A row is not deleted while a Live Row of any Space refers to it. One query asks every
 * referring table at once and stops at the first referring row of each; only a refused row is
 * counted, with one count per referring column. A row's reference to itself does not protect it.
 */
function deleteRule(target: string, referring: readonly Reference[]): RegisteredRule {
  return {
    table: target,
    write: "delete",
    reasons: [referenced],
    async answer(
      tx: Untyped,
      context: StorageContext,
      rows: readonly { readonly id: string }[],
    ): Promise<readonly RuleAnswer<string, typeof referenced>[]> {
      if (rows.length === 0) return [];
      // An unknown or deleted row, or one of another Space, gets no answer: it stays not found.
      const blocked = await tx
        .selectFrom(`${target} as target`)
        .select("target.id")
        .where("target.space_id", "=", context.spaceId)
        .where("target.deleted_at", "is", null)
        .where(
          "target.id",
          "in",
          rows.map(({ id }) => id),
        )
        .where((eb) =>
          eb.or(
            referring.map(({ table, column }, index) => {
              let lookup = eb
                .selectFrom(`${table} as referring${index}`)
                .select(eb.lit(1).as("one"))
                .whereRef(`referring${index}.${column}`, "=", "target.id")
                .where(`referring${index}.deleted_at`, "is", null);
              if (table === target)
                lookup = lookup.whereRef(`referring${index}.id`, "<>", "target.id");
              return eb.exists(lookup);
            }),
          ),
        )
        .execute();
      if (blocked.length === 0) return [];
      const ids = blocked.map(({ id }) => id as string);
      const counts = new Map<string, Map<string, number>>(ids.map((id) => [id, new Map()]));
      for (const { table, column } of referring) {
        let count = tx
          .selectFrom(table)
          .select((eb) => [eb.ref(column).as("target"), eb.fn.countAll<number>().as("count")])
          .where(column, "in", ids)
          .where("deleted_at", "is", null)
          .groupBy(column);
        if (table === target) count = count.whereRef("id", "<>", column);
        for (const { target: id, count: found } of await count.execute()) {
          const byTable = counts.get(id as string);
          byTable?.set(table, (byTable.get(table) ?? 0) + found);
        }
      }
      return ids.map((id) => ({
        code: referenced.code,
        row: id,
        details: {
          tables: [...(counts.get(id) ?? [])].map(([table, count]) => ({ table, count })),
        },
      }));
    },
  };
}
