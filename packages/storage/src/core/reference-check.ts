import type { Reference } from "@self-engine/db";
import { type FrameReasons, referenced, targetDeleted } from "@self-engine/db/schema";
import type { Transaction } from "kysely";
import type { StorageContext } from "./context.ts";
import { noPartRows, ownerIsLive, type PartReference, type PartRows } from "./part-rows.ts";
import type { RegisteredRule, RuleAnswer } from "./registry.ts";

/** The read access of a rule over tables the frame knows only by name. */
type Untyped = Transaction<Record<string, Record<string, string | null>>>;

/**
 * The reference check, the Protection Rule the frame brings itself (D337, D338): no Live Row
 * refers to a deleted row. It is built once from the references the Data Process read at its
 * start, so no module writes code for it and no lower module learns of an upper one. It guards
 * the three ways the sentence breaks: a delete of a target, and an insert, update or restore of
 * a referring row. Every reference protects its target; an archived row is a Live Row, and
 * archive and unarchive are not guarded.
 *
 * A Part Row is a Live Row only while its owner is one (ADR 0042): its reference to its owner
 * protects nothing, its other references protect only while the owner is live and count the
 * owner, and an owner is restored only while its live Part Rows refer to Live Rows. A row of such
 * a table that names no owner is an ordinary row.
 */
export function referenceCheck(
  references: readonly Reference[],
  parts: PartRows = noPartRows,
): {
  readonly rules: readonly RegisteredRule<string, FrameReasons>[];
} {
  const protecting = references.filter((reference) => !parts.isOwnerReference(reference));
  const targets = [...new Set(protecting.map(({ target }) => target))];
  const referring = [...new Set(references.map(({ table }) => table))];
  const owners = [...new Set(references.map(({ target }) => target))].filter(
    (owner) => parts.partsOf(owner).length > 0,
  );
  return {
    rules: [
      ...targets.map((target) =>
        deleteRule(
          target,
          protecting
            .filter((reference) => reference.target === target)
            .map((reference) => ({ ...reference, part: parts.ownerOf(reference.table) })),
        ),
      ),
      ...owners.map((owner) =>
        ownerRestoreRule(
          parts.partsOf(owner).map((part) => ({
            ...part,
            references: protecting.filter(({ table }) => table === part.table),
          })),
          owner,
        ),
      ),
      ...referring.flatMap((table) => {
        const own = references.filter((reference) => reference.table === table);
        return (["insert", "update", "restore"] as const).map((write) =>
          targetRule(table, write, own),
        );
      }),
    ],
  };
}

/** A row and the values of its reference columns, as written or as stored. */
interface Referring {
  readonly id: string;
  readonly values: Readonly<Record<string, unknown>>;
}

/**
 * A reference that is written or restored points to a Live Row of the same Space (D337); a
 * restore judges the row as it stands afterwards (D371). An update asks only for the reference
 * columns it writes, so one that writes none runs no query; an empty optional reference and a
 * row's reference to itself ask nothing. Each target table is asked once, by primary key, for
 * every row; an unknown, deleted or foreign target is refused before the database's own foreign
 * key error.
 */
function targetRule(
  table: string,
  write: "insert" | "update" | "restore",
  references: readonly Reference[],
): RegisteredRule<string, typeof targetDeleted> {
  return {
    table,
    write,
    reasons: [targetDeleted],
    async answer(
      tx: Untyped,
      context: StorageContext,
      rows: readonly { readonly id: string; readonly values?: Referring["values"] }[],
    ): Promise<readonly RuleAnswer<string, typeof targetDeleted>[]> {
      const written: readonly Referring[] =
        write === "restore"
          ? await deletedRows(tx, context, table, references, rows)
          : rows.map(({ id, values }) => ({ id, values: values ?? {} }));
      const asked = written.flatMap(({ id, values }) =>
        references.flatMap(({ column, target }) => {
          const value = values[column];
          return typeof value === "string" && !(target === table && value === id)
            ? [{ row: id, column, target, id: value }]
            : [];
        }),
      );
      if (asked.length === 0) return [];
      const live = await liveTargets(tx, context, asked);
      return asked
        .filter(({ target, id }) => !live.get(target)?.has(id))
        .map(({ row, column, target, id }) => ({
          code: targetDeleted.code,
          row,
          field: column,
          details: { target: { table: target, id } },
        }));
    },
  };
}

/**
 * The ids of each target table that are Live Rows of this Space: one lookup by primary key per
 * table, for every asked row.
 */
async function liveTargets(
  tx: Untyped,
  context: StorageContext,
  asked: readonly { readonly target: string; readonly id: string }[],
): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const live = new Map<string, Set<string>>();
  for (const target of new Set(asked.map((reference) => reference.target))) {
    const ids = asked.filter((reference) => reference.target === target).map(({ id }) => id);
    const found = await tx
      .selectFrom(target)
      .select("id")
      .where("id", "in", [...new Set(ids)])
      .where("space_id", "=", context.spaceId)
      .where("deleted_at", "is", null)
      .execute();
    live.set(target, new Set(found.map(({ id }) => id as string)));
  }
  return live;
}

/** A table of Part Rows with the references that protect their targets, its owner's excepted. */
interface OwnedPart extends PartReference {
  readonly references: readonly Reference[];
}

/**
 * An owner is restored only while none of its live Part Rows refers to a deleted, unknown or
 * foreign row (ADR 0042): its Part Rows become live with it, so the restore is judged with what
 * they refer to. One lookup of the Part Rows per table and one of the targets per target table.
 * The Reason stands at the owner, with the table of the Part Rows as its field and one Reason
 * per target. A Part Row removed from its owner counts for nothing.
 */
function ownerRestoreRule(
  parts: readonly OwnedPart[],
  owner: string,
): RegisteredRule<string, typeof targetDeleted> {
  return {
    table: owner,
    write: "restore",
    reasons: [targetDeleted],
    async answer(
      tx: Untyped,
      context: StorageContext,
      rows: readonly { readonly id: string }[],
    ): Promise<readonly RuleAnswer<string, typeof targetDeleted>[]> {
      if (rows.length === 0) return [];
      const asked: { row: string; field: string; target: string; id: string }[] = [];
      for (const part of parts) {
        if (part.references.length === 0) continue;
        const found = await tx
          .selectFrom(part.table)
          .select([part.column, ...part.references.map(({ column }) => column)])
          .where(
            part.column,
            "in",
            rows.map(({ id }) => id),
          )
          .where("space_id", "=", context.spaceId)
          .where("deleted_at", "is", null)
          .execute();
        for (const row of found)
          for (const { column, target } of part.references) {
            const value = row[column];
            const ownerId = row[part.column];
            if (typeof value !== "string" || typeof ownerId !== "string") continue;
            if (
              !asked.some(
                (known) =>
                  known.row === ownerId &&
                  known.field === part.table &&
                  known.target === target &&
                  known.id === value,
              )
            )
              asked.push({ row: ownerId, field: part.table, target, id: value });
          }
      }
      if (asked.length === 0) return [];
      const live = await liveTargets(tx, context, asked);
      return asked
        .filter(({ target, id }) => !live.get(target)?.has(id))
        .map(({ row, field, target, id }) => ({
          code: targetDeleted.code,
          row,
          field,
          details: { target: { table: target, id } },
        }));
    },
  };
}

/**
 * The deleted rows of this Space a restore names, with their reference columns as they stand
 * after the restore: the value written with it, the stored one for every other (D371). One lookup
 * by primary key; a live, unknown or foreign row gets no answer: the restore stays not found.
 */
async function deletedRows(
  tx: Untyped,
  context: StorageContext,
  table: string,
  references: readonly Reference[],
  rows: readonly { readonly id: string; readonly values?: Referring["values"] }[],
): Promise<readonly Referring[]> {
  if (rows.length === 0) return [];
  const found = await tx
    .selectFrom(table)
    .select(["id", ...references.map(({ column }) => column)])
    .where(
      "id",
      "in",
      rows.map(({ id }) => id),
    )
    .where("space_id", "=", context.spaceId)
    .where("deleted_at", "is not", null)
    .execute();
  const written = new Map(rows.map(({ id, values }) => [id, values]));
  return found.map((row) => ({
    id: row.id as string,
    values: { ...row, ...written.get(row.id as string) },
  }));
}

/**
 * A row is not deleted while a Live Row of any Space refers to it. One query asks every
 * referring table at once and stops at the first referring row of each; only a refused row is
 * counted, with one count per referring column. A row's reference to itself does not protect it.
 */
function deleteRule(
  target: string,
  referring: readonly (Reference & { readonly part: PartReference | undefined })[],
): RegisteredRule<string, typeof referenced> {
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
            referring.map(({ table, column, part }, index) => {
              let lookup = eb
                .selectFrom(`${table} as referring${index}`)
                .select(eb.lit(1).as("one"))
                .whereRef(`referring${index}.${column}`, "=", "target.id")
                .where(`referring${index}.deleted_at`, "is", null);
              if (table === target)
                lookup = lookup.whereRef(`referring${index}.id`, "<>", "target.id");
              // A Part Row protects only while its owner is a Live Row (ADR 0042).
              if (part !== undefined) lookup = lookup.where(ownerIsLive(`referring${index}`, part));
              return eb.exists(lookup);
            }),
          ),
        )
        .execute();
      if (blocked.length === 0) return [];
      const ids = blocked.map(({ id }) => id as string);
      const counts = new Map<string, Map<string, number>>(ids.map((id) => [id, new Map()]));
      for (const { table, column, part } of referring) {
        if (part !== undefined) {
          // Part Rows count their live owners, under the owner's table (ADR 0042).
          const owned = await tx
            .selectFrom(`${table} as part`)
            .innerJoin(`${part.owner} as part_owner`, "part_owner.id", `part.${part.column}`)
            .select((eb) => [
              eb.ref(`part.${column}`).as("target"),
              eb.fn.count<number>(`part.${part.column}`).distinct().as("count"),
            ])
            .where(`part.${column}`, "in", ids)
            .where("part.deleted_at", "is", null)
            .where("part_owner.deleted_at", "is", null)
            .groupBy(`part.${column}`)
            .execute();
          for (const { target: id, count: found } of owned) {
            const byTable = counts.get(id as string);
            byTable?.set(part.owner, (byTable.get(part.owner) ?? 0) + found);
          }
        }
        let count = tx
          .selectFrom(table)
          .select((eb) => [eb.ref(column).as("target"), eb.fn.countAll<number>().as("count")])
          .where(column, "in", ids)
          .where("deleted_at", "is", null)
          .groupBy(column);
        // A row that names no owner is an ordinary row and counts under its own table.
        if (part !== undefined) count = count.where(part.column, "is", null);
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
