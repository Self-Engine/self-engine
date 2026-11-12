import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { SelectQueryBuilder } from "kysely";
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
    direction: z.enum(["before", "after"]),
    values: z.array(z.union([z.string(), z.number().finite()])),
  })
  .strict();

/** A fixed keyset order, always ending in id. Cursors are authenticated per list instance. */
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
  readonly order: readonly Sort<Row>[];
  readonly map: (row: Row) => Output;
  readonly size?: number;
}) {
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
  const key = crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  async function cursor(direction: "before" | "after", row: Row) {
    const payload = new TextEncoder().encode(
      JSON.stringify({ direction, values: order.map(({ column }) => row[column as keyof Row]) }),
    );
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key, payload));
    return `${encode(payload)}.${encode(signature)}`;
  }
  async function readCursor(value: string | undefined) {
    if (value === undefined) return undefined;
    try {
      const parts = value.split(".");
      if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined)
        throw new Error("Invalid cursor");
      const payload = decode(parts[0]);
      const signature = decode(parts[1]);
      // Reject noncanonical encodings too: every change to a cursor is invalid input.
      if (
        encode(payload) !== parts[0] ||
        encode(signature) !== parts[1] ||
        !(await crypto.subtle.verify("HMAC", await key, signature, payload))
      )
        throw new Error("Invalid cursor");
      const parsed = cursorPayload.parse(JSON.parse(new TextDecoder().decode(payload)));
      if (parsed.values.length !== order.length) throw new Error("Invalid cursor");
      return parsed;
    } catch {
      throw new ORPCError("BAD_REQUEST");
    }
  }
  async function build(tx: ReadTransaction<DB>, context: StorageContext, input: Input) {
    const anchor = await readCursor(input.cursor);
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
      query = query.where((eb) => {
        const first = order[0];
        const second = order[1];
        if (
          order.length === 2 &&
          first !== undefined &&
          second !== undefined &&
          first.direction === second.direction
        ) {
          return eb(
            eb.refTuple(first.column, second.column),
            (first.direction === "asc") !== backwards ? ">" : "<",
            eb.tuple(anchor.values[0]!, anchor.values[1]!),
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
                (item.direction === "asc") !== backwards ? ">" : "<",
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
      async queries(tx: ReadTransaction<DB>, context: StorageContext, input: Input) {
        const { query } = await build(tx, context, input);
        const queries = [query.compile()];
        const row = (await query.execute())[0];
        if (row !== undefined) {
          for (const direction of ["before", "after"] as const) {
            const next = await build(tx, context, {
              ...input,
              cursor: await cursor(direction, row),
            });
            queries.push(next.query.compile());
          }
        }
        return queries;
      },
    },
    async run(
      tx: ReadTransaction<DB>,
      context: StorageContext,
      input: Input,
    ): Promise<Page<Output>> {
      const { query, anchor, backwards } = await build(tx, context, input);
      const found = await query.execute();
      const more = found.length > size;
      const rows = found.slice(0, size);
      if (backwards) rows.reverse();
      const first = rows[0];
      const last = rows.at(-1);
      return {
        rows: rows.map(options.map),
        before:
          first !== undefined && (backwards ? more : anchor !== undefined)
            ? await cursor("before", first)
            : null,
        after:
          last !== undefined && (backwards ? anchor !== undefined : more)
            ? await cursor("after", last)
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
