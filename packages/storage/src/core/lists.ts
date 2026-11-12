import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { ExpressionWrapper, TupleNode, type SelectQueryBuilder } from "kysely";
import type { ReadTransaction } from "./module.ts";
import type { StorageContext } from "./context.ts";

export const pageInputSchema = z.object({ cursor: z.string().optional() }).strict();
export function pageSchema<Row extends z.ZodType>(row: Row) {
  return z.object({
    rows: z.array(row),
    before: z.string().nullable(),
    after: z.string().nullable(),
  });
}
type PageInput = z.output<typeof pageInputSchema>;
type Scalar = string | number;
type Sort<Row> = {
  readonly column: {
    [Key in keyof Row & string]: Row[Key] extends Scalar ? Key : never;
  }[keyof Row & string];
  readonly direction: "asc" | "desc";
};
export interface Page<Row> {
  readonly rows: Row[];
  readonly before: string | null;
  readonly after: string | null;
}
function encode(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode(text: string) {
  return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
    char.charCodeAt(0),
  );
}
const cursorPayload = z
  .object({
    list: z.string(),
    direction: z.enum(["before", "after"]),
    values: z.array(z.union([z.string(), z.number().finite()])),
    inclusive: z.literal(true).optional(),
  })
  .strict();

/**
 * A fixed keyset order, always ending in id. Cursors carry the stable contract entry name.
 * Cursor predicates and ordering use unqualified selected column names. Joined queries must
 * expose unambiguous sort columns; wrap a join in a subquery when names overlap.
 */
export function pageList<
  DB,
  Table extends keyof DB & string,
  Row extends { id: string },
  Input extends PageInput,
  Output,
>(options: {
  readonly query: (
    tx: ReadTransaction<DB>,
    context: StorageContext,
    input: Input,
  ) => SelectQueryBuilder<DB, Table, Row>;
  /** Reuse the selected row schema so cursor values are checked before querying. */
  readonly row: { readonly shape: { [Key in keyof Row & string]: z.core.$ZodType<Row[Key]> } };
  readonly order: readonly Sort<Row>[];
  readonly map: (row: Row) => Output;
  readonly size?: number;
}) {
  const columns: Readonly<Record<string, z.core.$ZodType>> = options.row.shape;
  const size = options.size ?? 100;
  const order: readonly { readonly column: string; readonly direction: "asc" | "desc" }[] =
    options.order.map((item) => ({ ...item }));
  if (!Number.isInteger(size) || size < 1 || size > 500)
    throw new Error("Page size must be an integer from 1 to 500");
  if (
    order.length === 0 ||
    order.at(-1)?.column !== "id" ||
    new Set(order.map((item) => item.column)).size !== order.length
  )
    throw new Error("Page order must end in id and contain no repeated columns");
  function cursor(list: string, direction: "before" | "after", row: Row) {
    return encode(
      new TextEncoder().encode(
        JSON.stringify({
          list,
          direction,
          values: order.map(({ column }) => row[column as keyof Row]),
        }),
      ),
    );
  }
  function readCursor(value: string | undefined, list: string) {
    if (value === undefined) return undefined;
    try {
      const payload = decode(value);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
      const parsed = cursorPayload.parse(JSON.parse(text));
      if (
        encode(payload) !== value ||
        JSON.stringify(parsed) !== text ||
        parsed.list !== list ||
        parsed.values.length !== order.length ||
        order.some(({ column }, index) => {
          const schema = columns[column];
          return schema === undefined || !z.safeParse(schema, parsed.values[index]).success;
        })
      )
        throw new Error("Invalid cursor");
      return parsed;
    } catch {
      throw new ORPCError("BAD_REQUEST");
    }
  }
  async function build(
    tx: ReadTransaction<DB>,
    context: StorageContext,
    input: Input,
    list: string,
    planAnchor?: z.output<typeof cursorPayload>,
  ) {
    const anchor = planAnchor ?? readCursor(input.cursor, list);
    const backwards = anchor?.direction === "before";
    // Selected scalar columns are guaranteed by Sort<Row>. Kysely cannot infer references
    // from selected output keys, so the dynamic ordering is kept behind this private view.
    let query = options
      .query(tx, context, input)
      .clearOrderBy()
      .clearLimit()
      .clearOffset() as unknown as SelectQueryBuilder<
      Record<string, Record<string, Scalar>>,
      string,
      Row
    >;
    if (anchor !== undefined) {
      const first = order[0]!;
      if (!order.every((item) => item.direction === first.direction)) {
        // Redundant with the lexicographic predicate, but gives SQLite a seekable range.
        query = query.where(
          first.column,
          (first.direction === "asc") !== backwards ? ">=" : "<=",
          anchor.values[0]!,
        );
      }
      query = query.where((eb) => {
        const first = order[0];
        if (first !== undefined && order.every((item) => item.direction === first.direction)) {
          const operator =
            (first.direction === "asc") !== backwards
              ? anchor.inclusive
                ? ">="
                : ">"
              : anchor.inclusive
                ? "<="
                : "<";
          if (order.length === 1) return eb(first.column, operator, anchor.values[0]!);
          // Kysely's typed tuple overloads stop at five values; its tuple node is variadic.
          return eb(
            new ExpressionWrapper(
              TupleNode.create(order.map((item) => eb.ref(item.column).toOperationNode())),
            ),
            operator,
            new ExpressionWrapper(
              TupleNode.create(anchor.values.map((value) => eb.val(value).toOperationNode())),
            ),
          );
        }
        return eb.or(
          order.map((item, index) =>
            eb.and([
              ...order
                .slice(0, index)
                .map((prefix, previous) => eb(prefix.column, "=", anchor.values[previous]!)),
              eb(
                item.column,
                (item.direction === "asc") !== backwards
                  ? anchor.inclusive && index === order.length - 1
                    ? ">="
                    : ">"
                  : anchor.inclusive && index === order.length - 1
                    ? "<="
                    : "<",
                anchor.values[index]!,
              ),
            ]),
          ),
        );
      });
    }
    for (const item of order)
      query = query.orderBy(
        item.column,
        backwards ? (item.direction === "asc" ? "desc" : "asc") : item.direction,
      );
    return { query: query.limit(size + 1), anchor, backwards };
  }
  return {
    kind: "query" as const,
    list: {
      kind: "pages" as const,
      async queries(tx: ReadTransaction<DB>, context: StorageContext, input: Input, list: string) {
        const { query } = await build(tx, context, input, list);
        const queries = [query.compile()];
        const row = (await query.execute())[0];
        for (const direction of ["before", "after"] as const) {
          const next = await build(tx, context, input, list, {
            list,
            direction,
            // EXPLAIN needs the predicate even for an empty seed. Bound values do not
            // affect its plan, and these synthetic anchors never leave this diagnostic.
            values: order.map(({ column }) =>
              row === undefined ? 0 : (row[column as keyof Row] as Scalar),
            ),
          });
          queries.push(next.query.compile());
        }
        return queries;
      },
    },
    async run(
      tx: ReadTransaction<DB>,
      context: StorageContext,
      input: Input,
      list: string,
    ): Promise<Page<Output>> {
      const { query, anchor, backwards } = await build(tx, context, input, list);
      const found = await query.execute();
      const more = found.length > size;
      const rows = found.slice(0, size);
      if (backwards) rows.reverse();
      if (rows.length === 0 && anchor !== undefined) {
        const back = encode(
          new TextEncoder().encode(
            JSON.stringify({
              list,
              direction: backwards ? "after" : "before",
              values: anchor.values,
              inclusive: true,
            }),
          ),
        );
        return { rows: [], before: backwards ? null : back, after: backwards ? back : null };
      }
      const first = rows[0];
      const last = rows.at(-1);
      return {
        rows: rows.map(options.map),
        before:
          first !== undefined && (backwards ? more : anchor !== undefined)
            ? cursor(list, "before", first)
            : null,
        after:
          last !== undefined && (backwards ? anchor !== undefined : more)
            ? cursor(list, "after", last)
            : null,
      };
    },
  };
}

/** Explicitly unbounded domain window. The frame checks its returned array length. */
export function windowList<Args extends unknown[], Row>(
  run: (...args: Args) => Promise<Row[]> | Row[],
) {
  return { kind: "query" as const, list: { kind: "window" as const }, run };
}

/** Explicitly unbounded whole set, expected to stay small. */
export function smallSetList<Args extends unknown[], Row>(
  run: (...args: Args) => Promise<Row[]> | Row[],
) {
  return { kind: "query" as const, list: { kind: "small-set" as const }, run };
}
