import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../core/index.ts";
import { isSoundDatabaseFile, openDatabase } from "./index.ts";

let directory: string;
const opened: Database[] = [];

function open(path: string): Database {
  const database = openDatabase(path);
  opened.push(database);
  return database;
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "self-engine-db-backup-"));
});

afterEach(async () => {
  for (const database of opened.splice(0)) await database.close();
  rmSync(directory, { recursive: true });
});

async function noteIds(database: Database): Promise<string[]> {
  const { rows } = await sql<{ id: string }>`SELECT id FROM notes ORDER BY id`.execute(
    database.kysely,
  );
  return rows.map(({ id }) => id);
}

describe("backupTo", () => {
  test("the copy holds what was committed, also what still sits in the write-ahead log", async () => {
    const database = open(join(directory, "live.sqlite"));
    await database.executeScript(`
      CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;
      INSERT INTO notes VALUES ('a'), ('b');
    `);

    await database.backupTo(join(directory, "copy.sqlite"));

    await expect(noteIds(open(join(directory, "copy.sqlite")))).resolves.toEqual(["a", "b"]);
  });

  test("the copy is one file, and stays one file when it is checked", async () => {
    const database = open(join(directory, "live.sqlite"));
    await database.executeScript("CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;");

    await database.backupTo(join(directory, "copy.sqlite"));
    expect(isSoundDatabaseFile(join(directory, "copy.sqlite"))).toBe(true);

    expect(readdirSync(directory).filter((name) => name.startsWith("copy"))).toEqual([
      "copy.sqlite",
    ]);
  });

  test("a later write to the database does not reach the copy", async () => {
    const database = open(join(directory, "live.sqlite"));
    await database.executeScript(`
      CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;
      INSERT INTO notes VALUES ('a');
    `);
    await database.backupTo(join(directory, "copy.sqlite"));

    await database.executeScript("INSERT INTO notes VALUES ('b');");

    await expect(noteIds(open(join(directory, "copy.sqlite")))).resolves.toEqual(["a"]);
  });

  test("a database in memory can be backed up too", async () => {
    const database = open(":memory:");
    await database.executeScript(`
      CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT;
      INSERT INTO notes VALUES ('a');
    `);

    await database.backupTo(join(directory, "copy.sqlite"));

    await expect(noteIds(open(join(directory, "copy.sqlite")))).resolves.toEqual(["a"]);
  });
});

describe("isSoundDatabaseFile", () => {
  test("a file that is no database is not sound", () => {
    const file = join(directory, "notes.sqlite");
    writeFileSync(file, "These are my notes, not a database.".repeat(200));

    expect(isSoundDatabaseFile(file)).toBe(false);
  });

  test("a missing file is not sound, and is not created by the check", () => {
    const file = join(directory, "missing.sqlite");

    expect(isSoundDatabaseFile(file)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });
});
