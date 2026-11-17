import type { Database } from "@self-engine/db";
import { CompiledQuery, type KyselyPlugin } from "kysely";

/**
 * For tests only: records every statement run through a query layer with `plugin`, so a test
 * can see how often a path asks the database and how SQLite plans each statement.
 */
export function recordStatements(database: Database) {
  const statements: CompiledQuery[] = [];
  const plugin: KyselyPlugin = {
    transformQuery({ node, queryId }) {
      statements.push(database.kysely.getExecutor().compileQuery(node, queryId));
      return node;
    },
    transformResult: async ({ result }) => result,
  };
  return {
    plugin,
    statements,
    /** The lines of SQLite's query plan for every recorded statement, e.g. `SCAN notes`. */
    async plans(): Promise<string[]> {
      const lines: string[] = [];
      for (const { sql, parameters } of statements) {
        const { rows } = await database.kysely.executeQuery<{ detail: string }>(
          CompiledQuery.raw(`EXPLAIN QUERY PLAN ${sql}`, [...parameters]),
        );
        lines.push(...rows.map(({ detail }) => detail));
      }
      return lines;
    },
  };
}
