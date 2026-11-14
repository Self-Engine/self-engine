import { sql } from "kysely";
import type { Database } from "../core/index.ts";

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
