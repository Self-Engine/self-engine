import { resolve } from "node:path";
import { sql } from "kysely";
import { build } from "vite-plus";
import { describe, expect, test } from "vite-plus/test";
import { sqlModuleMigrations } from "../../test/sql-module/index.ts";
import { createMigrationRunner } from "../core/index.ts";
import { openDatabase } from "./index.ts";

const SQL_MODULE = resolve(import.meta.dirname, "../../test/sql-module");

describe("a module's SQL files", () => {
  test("load in Vitest and run, with every statement of a file", async () => {
    const database = openDatabase(":memory:");

    await expect(createMigrationRunner(database, sqlModuleMigrations).run()).resolves.toEqual([
      "sql-module/0001",
      "sql-module/0002",
    ]);

    const { rows } = await sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE name LIKE 'sql_module_%' ORDER BY name
    `.execute(database.kysely);
    expect(rows.map((row) => row.name)).toEqual([
      "sql_module_notes",
      "sql_module_notes_body",
      "sql_module_tags",
    ]);
    await database.close();
  });

  test("reach the bundle of a Vite build as text", async () => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: SQL_MODULE,
      build: { write: false, rollupOptions: { input: resolve(SQL_MODULE, "index.ts") } },
    });
    if (!("output" in result)) throw new Error("Expected one build output");
    const code = result.output.flatMap((item) => (item.type === "chunk" ? [item.code] : [])).join();

    expect(code).toContain("CREATE TABLE sql_module_notes");
    expect(code).toContain("CREATE INDEX sql_module_notes_body");
    expect(code).toContain("CREATE TABLE sql_module_tags");
  });
});
