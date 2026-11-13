// The Backups over real SQLite files in a temporary folder, with a clock the test moves (D94).

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources, type TestSources } from "@self-engine/db/testing";
import { sql } from "kysely";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { applyStagedRestore, type Backups, createBackups } from "./index.ts";

const DAY_MS = 86_400_000;

let folder: string;
let databasePath: string;
let directory: string;
let sources: TestSources;
const opened: Database[] = [];

function open(path: string): Database {
  const database = openDatabase(path);
  opened.push(database);
  return database;
}

async function closeAll(): Promise<void> {
  for (const database of opened.splice(0)) await database.close();
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "self-engine-backup-"));
  databasePath = join(folder, "self-engine.sqlite");
  directory = join(folder, "backups");
  // A Friday, at noon UTC.
  sources = createTestSources(new Date("2026-11-13T12:00:00.000Z"));
});

afterEach(async () => {
  await closeAll();
  rmSync(folder, { recursive: true });
});

/** The database with one note, and its Backups. */
async function start(): Promise<{ database: Database; backups: Backups }> {
  const database = open(databasePath);
  await database.executeScript(`
    CREATE TABLE IF NOT EXISTS notes (body TEXT PRIMARY KEY) STRICT;
    INSERT OR IGNORE INTO notes VALUES ('first');
  `);
  return {
    database,
    backups: createBackups({ database, databasePath, directory, clock: sources.clock }),
  };
}

async function notes(database: Database): Promise<string[]> {
  const { rows } = await sql<{ body: string }>`SELECT body FROM notes ORDER BY rowid`.execute(
    database.kysely,
  );
  return rows.map(({ body }) => body);
}

const write = (database: Database, body: string) =>
  database.executeScript(`INSERT INTO notes VALUES ('${body}');`);

const backupFile = (id: string) => join(directory, `${id}.sqlite`);

test("a Backup taken by hand is a file in the folder that opens and holds the data", async () => {
  const { backups } = await start();

  const backup = await backups.create();

  expect(backup).toEqual({
    id: "2026-11-13T12-00-00-000Z-manual",
    takenAt: "2026-11-13T12:00:00.000Z",
    kind: "manual",
    sizeBytes: expect.any(Number),
  });
  expect(backup.sizeBytes).toBeGreaterThan(0);
  expect(readdirSync(directory)).toEqual(["2026-11-13T12-00-00-000Z-manual.sqlite"]);
  await expect(notes(open(backupFile(backup.id)))).resolves.toEqual(["first"]);
});

test("the list holds every Backup, newest first, and is empty before the first one", async () => {
  const { backups } = await start();
  await expect(backups.list()).resolves.toEqual([]);

  const first = await backups.create();
  sources.advance(60_000);
  const second = await backups.create();

  await expect(backups.list()).resolves.toEqual([second, first]);
});

test("the list leaves out files that are no Backups of this app", async () => {
  const { backups } = await start();
  const backup = await backups.create();
  writeFileSync(join(directory, "notes.txt"), "mine");
  writeFileSync(join(directory, "copy of my data.sqlite"), "mine");

  await expect(backups.list()).resolves.toEqual([backup]);
});

test("the daily Backup is taken once per UTC day", async () => {
  const { backups } = await start();

  const first = await backups.backUpIfDue();
  sources.advance(11 * 60 * 60 * 1000 + 59 * 60 * 1000);
  const sameDay = await backups.backUpIfDue();
  sources.advance(60 * 1000);
  const nextDay = await backups.backUpIfDue();

  expect(first?.kind).toBe("daily");
  expect(sameDay).toBeUndefined();
  expect(nextDay).toMatchObject({ kind: "daily", takenAt: "2026-11-14T00:00:00.000Z" });
});

test("no daily Backup is taken on a day that has a Backup of another kind", async () => {
  const { backups } = await start();
  await backups.create();

  await expect(backups.backUpIfDue()).resolves.toBeUndefined();
});

test("the Backup before migrations is taken of a database that has tables", async () => {
  const { backups } = await start();

  const backup = await backups.backUpBeforeMigrations();

  expect(backup?.kind).toBe("before-migration");
  await expect(notes(open(backupFile(backup!.id)))).resolves.toEqual(["first"]);
});

test("a database without tables gets no Backup before its first migrations", async () => {
  const database = open(databasePath);
  const backups = createBackups({ database, databasePath, directory, clock: sources.clock });

  await expect(backups.backUpBeforeMigrations()).resolves.toBeUndefined();
  await expect(backups.list()).resolves.toEqual([]);
});

test("after two months of daily Backups seven daily and four weekly ones are kept", async () => {
  const { backups } = await start();
  // From the 13th of November 2026, a Friday, to the 12th of January 2027, a Tuesday.
  for (let day = 0; day < 61; day++) {
    await backups.backUpIfDue();
    sources.advance(DAY_MS);
  }

  const kept = (await backups.list()).map(({ takenAt }) => takenAt.slice(0, 10));

  expect(kept).toEqual([
    // Seven days, Wednesday to Tuesday.
    "2027-01-12",
    "2027-01-11",
    "2027-01-10",
    "2027-01-09",
    "2027-01-08",
    "2027-01-07",
    "2027-01-06",
    // Before them, the newest Backup of each of four weeks: the Tuesday the seven days left of
    // their own week, and three Sundays.
    "2027-01-05",
    "2027-01-03",
    "2026-12-27",
    "2026-12-20",
  ]);
  expect(readdirSync(directory)).toHaveLength(11);
});

test("pruning also removes what a crash left half written", async () => {
  const { backups } = await start();
  await backups.create();
  writeFileSync(join(directory, "2026-11-12T12-00-00-000Z-daily.sqlite.partial"), "half");
  sources.advance(1000);

  await backups.create();

  expect(readdirSync(directory).filter((name) => name.endsWith(".partial"))).toEqual([]);
});

test("a Backup taken while the clock is set back survives its own pruning", async () => {
  const { backups } = await start();
  for (let day = 0; day < 12; day++) {
    await backups.backUpIfDue();
    sources.advance(DAY_MS);
  }
  // Six weeks back: older than everything the retention would keep.
  sources.advance(-54 * DAY_MS);

  const backup = await backups.create();

  expect((await backups.list()).map(({ id }) => id)).toContain(backup.id);
});

test("calls made at once take their Backups one after the other", async () => {
  const { backups } = await start();

  const [daily, again] = await Promise.all([backups.backUpIfDue(), backups.backUpIfDue()]);

  expect(daily?.kind).toBe("daily");
  expect(again).toBeUndefined();
});

test("a restore brings back the data of the Backup at the next start and keeps what it replaced", async () => {
  const { database, backups } = await start();
  const backup = await backups.create();
  await write(database, "second");
  sources.advance(1000);

  const outcome = await backups.restore(backup.id);

  // Until the Data Process starts anew, the database is what it was.
  await expect(notes(database)).resolves.toEqual(["first", "second"]);
  expect(outcome).toEqual({
    status: "restored",
    replaced: expect.objectContaining({
      kind: "before-restore",
      takenAt: "2026-11-13T12:00:01.000Z",
    }),
  });
  await closeAll();
  expect(applyStagedRestore(databasePath)).toBe(true);

  await expect(notes(open(databasePath))).resolves.toEqual(["first"]);
  const replaced = outcome.status === "restored" ? outcome.replaced.id : "";
  await expect(notes(open(backupFile(replaced)))).resolves.toEqual(["first", "second"]);
});

test("a restore can be taken back by restoring the Backup of what it replaced", async () => {
  const first = await start();
  const backup = await first.backups.create();
  await write(first.database, "second");
  sources.advance(1000);
  const outcome = await first.backups.restore(backup.id);
  await closeAll();
  applyStagedRestore(databasePath);

  const second = await start();
  sources.advance(1000);
  await second.backups.restore(outcome.status === "restored" ? outcome.replaced.id : "");
  await closeAll();
  applyStagedRestore(databasePath);

  await expect(notes(open(databasePath))).resolves.toEqual(["first", "second"]);
});

test("a restored database opens although the replaced one left a write-ahead log behind", async () => {
  const { database, backups } = await start();
  const backup = await backups.create();
  await write(database, "second");
  sources.advance(1000);
  await backups.restore(backup.id);
  // The Data Process is killed for the restart: its database is never closed, so its log stays.
  expect(readdirSync(folder)).toContain("self-engine.sqlite-wal");

  expect(applyStagedRestore(databasePath)).toBe(true);

  expect(readdirSync(folder).toSorted()).toEqual(["backups", "self-engine.sqlite"]);
  const restored = openDatabase(databasePath);
  await expect(notes(restored)).resolves.toEqual(["first"]);
  await restored.close();
});

test("a start without a staged restore leaves the database alone", async () => {
  await start();
  await closeAll();

  expect(applyStagedRestore(databasePath)).toBe(false);

  await expect(notes(open(databasePath))).resolves.toEqual(["first"]);
});

test("a copy that a crash left half staged is never applied", async () => {
  await start();
  await closeAll();
  writeFileSync(`${databasePath}.restore.partial`, "half a database");

  expect(applyStagedRestore(databasePath)).toBe(false);

  expect(readdirSync(folder)).toEqual(["self-engine.sqlite"]);
  await expect(notes(open(databasePath))).resolves.toEqual(["first"]);
});

test.each([
  ["a Backup that was pruned", "2026-01-01T12-00-00-000Z-daily"],
  ["a path out of the folder", "../self-engine"],
])("restoring %s finds nothing and stages nothing", async (_what, id) => {
  const { backups } = await start();
  await backups.create();

  await expect(backups.restore(id)).resolves.toEqual({ status: "notFound" });

  expect(readdirSync(folder).toSorted()).toEqual([
    "backups",
    "self-engine.sqlite",
    "self-engine.sqlite-shm",
    "self-engine.sqlite-wal",
  ]);
  expect(await backups.list()).toHaveLength(1);
});

test("a Backup whose file is no sound database is not restored, and nothing is backed up for it", async () => {
  const { backups } = await start();
  const backup = await backups.create();
  writeFileSync(backupFile(backup.id), "no database any more".repeat(500));

  await expect(backups.restore(backup.id)).resolves.toEqual({ status: "unreadable" });

  expect(applyStagedRestore(databasePath)).toBe(false);
  expect((await backups.list()).map(({ kind }) => kind)).toEqual(["manual"]);
});

test("a restore whose Backup of the replaced data fails stages nothing", async () => {
  const { database, backups } = await start();
  const backup = await backups.create();
  sources.advance(1000);
  const failing = createBackups({
    database: {
      ...database,
      backupTo: () => Promise.reject(new Error("The disk is full")),
    },
    databasePath,
    directory,
    clock: sources.clock,
  });

  await expect(failing.restore(backup.id)).rejects.toThrow("The disk is full");

  await closeAll();
  expect(applyStagedRestore(databasePath)).toBe(false);
  await expect(notes(open(databasePath))).resolves.toEqual(["first"]);
});

test("a Backup that fails does not stop the ones after it", async () => {
  const { database } = await start();
  let full = true;
  const backups = createBackups({
    database: {
      ...database,
      backupTo: (destination) =>
        full ? Promise.reject(new Error("The disk is full")) : database.backupTo(destination),
    },
    databasePath,
    directory,
    clock: sources.clock,
  });

  await expect(backups.create()).rejects.toThrow("The disk is full");
  full = false;

  await expect(backups.create()).resolves.toMatchObject({ kind: "manual" });
});
