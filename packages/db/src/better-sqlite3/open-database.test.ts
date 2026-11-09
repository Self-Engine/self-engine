import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import SqliteDriver from "better-sqlite3";
import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../core/index.ts";
import { openDatabase } from "./index.ts";

let directory: string;
let file: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "self-engine-db-"));
  file = join(directory, "test.sqlite");
});

afterEach(() => {
  rmSync(directory, { recursive: true });
});

async function pragma(database: Database, name: string): Promise<unknown> {
  const { rows } = await sql<Record<string, unknown>>`PRAGMA ${sql.raw(name)}`.execute(
    database.kysely,
  );
  return Object.values(rows[0] ?? {})[0];
}

describe("openDatabase", () => {
  test.each([
    ["journal_mode", "wal"],
    ["busy_timeout", 5000],
    ["foreign_keys", 1],
    ["synchronous", 1], // NORMAL
    ["checkpoint_fullfsync", 1],
    ["temp_store", 2], // MEMORY
    ["journal_size_limit", 134_217_728], // 128 MiB
    ["auto_vacuum", 2], // INCREMENTAL
  ])("sets %s on a new database", async (name, expected) => {
    const database = openDatabase(file);

    await expect(pragma(database, name)).resolves.toBe(expected);
    await database.close();
  });

  test("a new database keeps incremental vacuum after tables exist and it is reopened", async () => {
    const first = openDatabase(file);
    await first.executeScript("CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;");
    await first.close();

    const reopened = openDatabase(file);

    await expect(pragma(reopened, "auto_vacuum")).resolves.toBe(2);
    await reopened.close();
  });

  test("leaves the vacuum mode of an existing database alone", async () => {
    const existing = new SqliteDriver(file);
    existing.exec("CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;");
    existing.close();

    const database = openDatabase(file);

    await expect(pragma(database, "auto_vacuum")).resolves.toBe(0);
    await database.close();
  });

  test("close closes the connection even when no query went through Kysely", async () => {
    const database = openDatabase(file);
    await database.executeScript("CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;");

    await database.close();

    await expect(Promise.resolve().then(() => database.executeScript("SELECT 1;"))).rejects.toThrow(
      /not open/,
    );
  });

  test("close also works after a query went through Kysely", async () => {
    const database = openDatabase(file);
    await pragma(database, "journal_mode");

    await expect(database.close()).resolves.toBeUndefined();
  });
});
