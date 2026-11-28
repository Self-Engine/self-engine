import type { Reference, TablesOf } from "@self-engine/db";
import type { ConventionKey, RowMap, SyncedTable } from "@self-engine/db/schema";
import type { Expression, ExpressionBuilder, SqlBool } from "kysely";

/**
 * The columns of a row that can name its owner: a reference that always holds a value, so a Part
 * Row never stands without one.
 */
type OwnerColumn<Row> = {
  [Column in Exclude<keyof Row, ConventionKey> & string]: Row[Column] extends string
    ? Column
    : never;
}[Exclude<keyof Row, ConventionKey> & string];

/**
 * The tables of a module whose rows are Part Rows, each with the reference its rows belong to
 * (ADR 0042). Typed against the row map; the start checks each against the schema's references.
 */
export type BelongsTo<Rows extends RowMap> = {
  readonly [Table in SyncedTable<TablesOf<Rows>>]?: OwnerColumn<TablesOf<Rows>[Table]>;
};

/** A table of Part Rows: the column that names the owner, and the owner's table. */
export interface PartReference {
  readonly table: string;
  readonly column: string;
  readonly owner: string;
}

/** Every table of Part Rows of a Data Process, by its own name and by its owner's. */
export interface PartRows {
  /** The owner reference of a table of Part Rows, or none for any other table. */
  ownerOf(table: string): PartReference | undefined;
  /** The tables of Part Rows that belong to rows of this table. */
  partsOf(owner: string): readonly PartReference[];
  /** Whether this reference names the owner of a Part Row. */
  isOwnerReference(reference: Pick<Reference, "table" | "column">): boolean;
}

const none: readonly PartReference[] = [];

export const noPartRows: PartRows = {
  ownerOf: () => undefined,
  partsOf: () => none,
  isOwnerReference: () => false,
};

/** An identifier as SQLite compares it: only the ASCII letters fold. */
function fold(name: string) {
  return name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/**
 * The Part Rows the modules declare, checked against the references the schema holds (ADR 0042):
 * each declared column is a reference of its table, a table does not belong to itself, and no
 * row refers to a Part Row, so an owner is never a Part Row itself. A broken declaration fails
 * the start.
 */
export function partRows(
  modules: readonly { readonly belongsTo?: Readonly<Record<string, string | undefined>> }[],
  references: readonly Reference[],
): PartRows {
  const parts: PartReference[] = [];
  for (const [table, column] of modules.flatMap((module) =>
    Object.entries(module.belongsTo ?? {}),
  )) {
    if (column === undefined) continue;
    const reference = references.find(
      (candidate) => candidate.table === table && fold(candidate.column) === fold(column),
    );
    if (reference === undefined)
      throw new Error(
        `${table}.${column} is named as the owner of a Part Row, but the schema holds no reference there`,
      );
    if (reference.target === table)
      throw new Error(`${table}.${column} names its own table: a Part Row cannot belong to it`);
    parts.push({ table, column: reference.column, owner: reference.target });
  }
  for (const part of parts) {
    const referring = references.find(({ target }) => target === part.table);
    if (referring !== undefined)
      throw new Error(
        `${part.table} holds Part Rows, which no row may refer to: ${referring.table}.${referring.column}`,
      );
  }
  const byTable = new Map(parts.map((part) => [part.table, part]));
  return {
    ownerOf: (table) => byTable.get(table),
    partsOf: (owner) => parts.filter((part) => part.owner === owner),
    isOwnerReference: ({ table, column }) => {
      const part = byTable.get(table);
      return part !== undefined && fold(part.column) === fold(column);
    },
  };
}

/** The expression builder of a query over tables the frame knows only by name. */
type Untyped = ExpressionBuilder<Record<string, Record<string, unknown>>, string>;

/**
 * The condition that a Part Row's owner is a Live Row (ADR 0042), for a query over `alias`: one
 * lookup of the owner by primary key. For any other table the caller adds nothing.
 */
export function ownerIsLive(
  alias: string,
  part: PartReference,
): <Builder>(eb: Builder) => Expression<SqlBool> {
  return (builder) => {
    // The frame names the tables; their convention columns are its own.
    const eb = builder as unknown as Untyped;
    return eb.exists(
      eb
        .selectFrom(`${part.owner} as part_owner`)
        .select(eb.lit(1).as("one"))
        .whereRef("part_owner.id", "=", `${alias}.${part.column}`)
        .where("part_owner.deleted_at", "is", null),
    );
  };
}
