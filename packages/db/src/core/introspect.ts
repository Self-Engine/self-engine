import { sql } from "kysely";
import type { Database } from "./database.ts";

export interface TableRow {
  readonly name: string;
  readonly strict: number;
  readonly sql: string;
}

export interface ColumnRow {
  readonly name: string;
  readonly type: string;
  readonly notnull: number;
  readonly dflt_value: string | null;
  readonly pk: number;
}

/** Returns main-schema tables with their SQL and STRICT flag, excluding SQLite and Kysely bookkeeping. */
export async function tablesOf(database: Database): Promise<readonly TableRow[]> {
  const { rows } = await sql<TableRow>`
    SELECT list.name, list.strict, entry.sql
    FROM pragma_table_list AS list
    JOIN sqlite_schema AS entry ON entry.name = list.name AND entry.type = 'table'
    WHERE list.schema = 'main'
    ORDER BY list.name
  `.execute(database.kysely);
  return rows.filter(
    ({ name }) =>
      !name.startsWith("sqlite_") && !["kysely_migration", "kysely_migration_lock"].includes(name),
  );
}

/** One column pair of a foreign key, as `foreign_key_list` reports it; `to` is null without a parent column. */
export interface ForeignKeyRow {
  readonly id: number;
  readonly table: string;
  readonly from: string;
  readonly to: string | null;
  readonly on_update: string;
  readonly on_delete: string;
}

export async function foreignKeyListOf(
  database: Database,
  table: string,
): Promise<readonly ForeignKeyRow[]> {
  const { rows } = await sql<ForeignKeyRow>`
    SELECT id, "table", "from", "to", on_update, on_delete
    FROM pragma_foreign_key_list(${table})
    ORDER BY id, seq
  `.execute(database.kysely);
  return rows;
}

export async function columnsOf(database: Database, table: string): Promise<readonly ColumnRow[]> {
  const { rows } = await sql<ColumnRow>`
    SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_xinfo(${table})
  `.execute(database.kysely);
  return rows;
}

/**
 * A reference the reference check guards (D337): a column of a synchronized table that refers
 * to the id of a synchronized table. `space_id` is the frame's own scoping, not a reference, a
 * Local Table's reference protects nothing, and a key over several columns is none.
 */
export interface Reference {
  /** The referring table. */
  readonly table: string;
  /** The referring column of `table`. */
  readonly column: string;
  /** The table whose `id` the column holds, named as the database names it. */
  readonly target: string;
}

/** Every reference between synchronized tables, read from the schema the migrations left. */
export async function referencesOf(database: Database): Promise<Reference[]> {
  const tables = (await tablesOf(database))
    .map(({ name }) => name)
    .filter((name) => !name.startsWith("local_"));
  // SQLite resolves a referenced table's and column's name in any case.
  const byName = new Map(tables.map((name) => [name.toLowerCase(), name]));
  const references: Reference[] = [];
  for (const table of tables) {
    const keys = await foreignKeyListOf(database, table);
    for (const key of keys) {
      const target = byName.get(key.table.toLowerCase());
      if (
        target === undefined ||
        key.from.toLowerCase() === "space_id" ||
        (key.to !== null && key.to.toLowerCase() !== "id") ||
        keys.some((other) => other.id === key.id && other !== key)
      )
        continue;
      references.push({ table, column: key.from, target });
    }
  }
  return references;
}
