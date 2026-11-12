import { describe, expect, it } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

describe("self-engine/no-raw-storage-sql", () => {
  it("reports raw SQL entry points, including aliases, namespace access and saved executors", () => {
    const results = lintFixtures("no-raw-storage-sql", [
      'import { sql } from "kysely"; sql`DELETE FROM notes`.execute(tx);',
      'import { sql as query } from "kysely"; query.raw("DELETE FROM notes").execute(tx);',
      'import { CompiledQuery as Query } from "kysely"; Query.raw("DELETE FROM notes");',
      'import * as queries from "kysely"; queries.sql`DELETE FROM notes`;',
      'import * as queries from "kysely"; const { sql: query } = queries;',
      'tx.executeQuery({ sql: "DELETE FROM notes", parameters: [] });',
      'database.executeScript("DELETE FROM notes");',
      'const execute = tx["executeQuery"];',
      "const { executeScript: run } = database;",
    ]);
    expect(results.map((hits) => hits.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(results.flat().every((hit) => hit.includes("Kysely builders"))).toBe(true);
  });

  it("accepts builder writes, builder reads and unrelated SQL names", () => {
    const results = lintFixtures("no-raw-storage-sql", [
      'await tx.insertInto("notes").values({ title: "Note" }).execute();',
      'await tx.updateTable("notes").set({ title: "Edited" }).execute();',
      'await tx.deleteFrom("notes").where("title", "=", "Old").execute();',
      'await tx.selectFrom("notes").selectAll().execute();',
      'import type { RawBuilder } from "kysely";',
      'import { sql } from "another-package"; sql();',
      'const sql = "a label";',
      'import * as queries from "kysely"; function render(queries: { sql: () => string }) { return queries.sql(); }',
      'import * as queries from "kysely"; function render(queries: { sql: () => string }) { const { sql } = queries; return sql(); }',
    ]);
    expect(results).toEqual([[], [], [], [], [], [], [], [], []]);
  });
});
