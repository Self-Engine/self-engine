import { sql } from "kysely";
import type { Database } from "./database.ts";

export interface UniqueIndex {
  readonly name: string;
  readonly table: string;
  /** SQLite's diagnostic for a column index, absent for expression indexes. */
  readonly columns: string | undefined;
}

/** Schema metadata only; primary keys identify rows rather than business conflicts. */
export async function uniqueIndexes(
  database: Database,
  tables: readonly string[],
): Promise<UniqueIndex[]> {
  const indexes: UniqueIndex[] = [];
  for (const table of tables) {
    const { rows } = await sql<{ name: string }>`
      SELECT name FROM pragma_index_list(${table}) WHERE "unique" = 1 AND origin <> 'pk'
    `.execute(database.kysely);
    for (const { name } of rows) {
      const { rows: columns } = await sql<{ name: string | null }>`
        SELECT name FROM pragma_index_info(${name}) ORDER BY seqno
      `.execute(database.kysely);
      indexes.push({
        name,
        table,
        columns: columns.some((column) => column.name === null)
          ? undefined
          : columns.map((column) => `${table}.${column.name}`).join(", "),
      });
    }
  }
  return indexes;
}
