import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { createMigrationRunner, MigrationRunError } from "../core/index.ts";
import type { Database, Migration } from "../core/index.ts";
import { openDatabase } from "./index.ts";

function createTable(name: string, table: string): Migration {
  return { name, sql: `CREATE TABLE ${table} (id TEXT PRIMARY KEY) STRICT;` };
}

let database: Database;

async function tables(): Promise<string[]> {
  // Kysely creates its two bookkeeping tables before the transaction starts, so they survive a failed run.
  const { rows } = await sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'kysely_%' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `.execute(database.kysely);
  return rows.map((row) => row.name);
}

beforeEach(() => {
  database = openDatabase(":memory:");
});

afterEach(async () => {
  await database.close();
});

describe("a migration run", () => {
  test("creates the tables of every migration and reports what it ran", async () => {
    const runner = createMigrationRunner(database, [
      createTable("time/0001", "time_entries"),
      createTable("finance/0001", "invoices"),
    ]);

    await expect(runner.run()).resolves.toEqual(["finance/0001", "time/0001"]);
    await expect(tables()).resolves.toEqual(["invoices", "time_entries"]);
  });

  test("a failing migration rolls back the whole run, including earlier migrations", async () => {
    const runner = createMigrationRunner(database, [
      createTable("finance/0001", "invoices"),
      createTable("time/0001", "time_entries"),
      { name: "time/0002", sql: "CREATE TABLE half (id TEXT) STRICT; THIS IS NOT SQL;" },
    ]);

    const run = runner.run();

    await expect(run).rejects.toBeInstanceOf(MigrationRunError);
    await expect(run).rejects.toMatchObject({ reason: "migrationFailed", migration: "time/0002" });
    await expect(tables()).resolves.toEqual([]);
  });

  test("a second run changes nothing", async () => {
    const migrations = [createTable("time/0001", "time_entries")];
    await createMigrationRunner(database, migrations).run();

    await expect(createMigrationRunner(database, migrations).run()).resolves.toEqual([]);
    await expect(tables()).resolves.toEqual(["time_entries"]);
  });

  test("refuses a database that ran a migration this app does not know", async () => {
    await createMigrationRunner(database, [
      createTable("time/0001", "time_entries"),
      createTable("time/0002", "time_breaks"),
    ]).run();

    const olderApp = createMigrationRunner(database, [createTable("time/0001", "time_entries")]);

    const run = olderApp.run();

    await expect(run).rejects.toBeInstanceOf(MigrationRunError);
    await expect(run).rejects.toMatchObject({ reason: "databaseNewer", migration: "time/0002" });
    await expect(run).rejects.toThrow(/time\/0002/);
  });

  test("runs a new module whose name sorts before the migrations that already ran", async () => {
    const time = createTable("time/0001", "time_entries");
    await createMigrationRunner(database, [time]).run();

    const withFinance = [createTable("finance/0001", "invoices"), time];

    await expect(createMigrationRunner(database, withFinance).run()).resolves.toEqual([
      "finance/0001",
    ]);
    await expect(tables()).resolves.toEqual(["invoices", "time_entries"]);
  });

  test("rejects two migrations with the same name", () => {
    expect(() =>
      createMigrationRunner(database, [
        createTable("time/0001", "time_entries"),
        createTable("time/0001", "time_breaks"),
      ]),
    ).toThrow(/time\/0001/);
  });

  test.each([
    "time",
    "time/1",
    "time/00001",
    "time/0001.sql",
    "/0001",
    "Time/0001",
    "my module/0001",
    "time/entries/0001",
    "../time/0001",
  ])("rejects the migration name %s", (name) => {
    expect(() => createMigrationRunner(database, [createTable(name, "time_entries")])).toThrow(
      name,
    );
  });

  test("accepts a module name with a hyphen or a digit", () => {
    expect(() =>
      createMigrationRunner(database, [
        createTable("sql-module/0001", "a"),
        createTable("i18n/0001", "b"),
      ]),
    ).not.toThrow();
  });

  test("reports whether migrations are pending", async () => {
    const runner = createMigrationRunner(database, [createTable("time/0001", "time_entries")]);

    await expect(runner.hasPending()).resolves.toBe(true);
    await runner.run();
    await expect(runner.hasPending()).resolves.toBe(false);
  });
});

test("preserves a migration setup error when its bookkeeping table cannot be read", async () => {
  await database.executeScript("PRAGMA query_only = ON;");
  await expect(createMigrationRunner(database, []).run()).rejects.toThrow(/readonly database/);
});
