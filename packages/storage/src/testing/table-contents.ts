import type { Database } from "@self-engine/db";

/** An order-independent snapshot of every real table, including tables absent from the row map. */
export async function tableContents(
  database: Database,
): Promise<ReadonlyMap<string, readonly string[]>> {
  const contents = new Map<string, readonly string[]>();
  const tables = await database.kysely.introspection.getTables();
  const queries = database.kysely.withTables<Record<string, Record<string, unknown>>>();
  for (const { name, isView } of tables) {
    if (isView) continue;
    const rows = await queries.selectFrom(name).selectAll().execute();
    contents.set(name, rows.map((row) => JSON.stringify(row)).sort());
  }
  return contents;
}
