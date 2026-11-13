// The Backups over real SQLite files in a temporary folder, with a clock the test moves (D94).

import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

const write = async (database: Database, body: string) =>
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

  const first = await backups.backUpIfDue();
  sources.advance(60_000);
  const second = await backups.create();

  await expect(backups.list()).resolves.toEqual([second, first]);
});

test("a second Backup of one kind on one day replaces the first, so a day holds at most four", async () => {
  const { backups } = await start();
  await backups.backUpIfDue();
  await backups.backUpBeforeMigrations();
  for (let press = 0; press < 5; press++) {
    sources.advance(60_000);
    await backups.create();
  }
  for (let restores = 0; restores < 3; restores++) {
    sources.advance(60_000);
    const [newest] = await backups.list();
    await backups.restore(newest!.id);
  }

  expect(
    (await backups.list()).map(({ kind, takenAt }) => `${kind} ${takenAt.slice(11, 16)}`),
  ).toEqual(["before-restore 12:08", "manual 12:05", "daily 12:00", "before-migration 12:00"]);
  expect(readdirSync(directory)).toHaveLength(4);
});

test("the Backup from before a migration is not deleted by the next Backups of that day", async () => {
  const { backups } = await start();
  const beforeMigration = await backups.backUpBeforeMigrations();
  sources.advance(1000);
  await backups.backUpIfDue();
  sources.advance(1000);
  await backups.create();
  sources.advance(1000);
  await backups.create();

  expect((await backups.list()).map(({ id }) => id)).toContain(beforeMigration?.id);
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

  // Until the Data Process starts anew, the database is what it was, and reads go on.
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

/** The database as the next Data Process finds it: closed, the staged restore put in place. */
async function startAnew(): Promise<{ database: Database; backups: Backups }> {
  await closeAll();
  applyStagedRestore(databasePath);
  return start();
}

test("restore, undo and restore again on one day: each restore can still be taken back", async () => {
  let { database, backups } = await start();
  const chosen = await backups.create();
  await write(database, "second");
  const restoreAndStartAnew = async (id: string) => {
    sources.advance(60_000);
    const outcome = await backups.restore(id);
    if (outcome.status !== "restored") throw new Error(outcome.status);
    // The Backup the Notice's Undo names is there when the restore answers.
    expect((await backups.list()).map((backup) => backup.id)).toContain(outcome.replaced.id);
    ({ database, backups } = await startAnew());
    return outcome.replaced;
  };

  const replacedByRestore = await restoreAndStartAnew(chosen.id);
  await expect(notes(database)).resolves.toEqual(["first"]);
  // Undo: restores the Backup of what the restore replaced.
  await restoreAndStartAnew(replacedByRestore.id);
  await expect(notes(database)).resolves.toEqual(["first", "second"]);
  const replacedBySecondRestore = await restoreAndStartAnew(chosen.id);
  await expect(notes(database)).resolves.toEqual(["first"]);

  // One Backup from before a restore is left of the three: the newest, of the data the last
  // restore replaced. The chosen Backup is still there too.
  expect((await backups.list()).map(({ id }) => id)).toEqual([
    replacedBySecondRestore.id,
    chosen.id,
  ]);
  await restoreAndStartAnew(replacedBySecondRestore.id);
  await expect(notes(database)).resolves.toEqual(["first", "second"]);
});

test("two restores in a row on one day keep only the Backup of what the second one replaced", async () => {
  let { database, backups } = await start();
  const older = await backups.backUpIfDue();
  await write(database, "second");
  sources.advance(60_000);
  const newer = await backups.create();
  await write(database, "third");

  sources.advance(60_000);
  const first = await backups.restore(newer.id);
  ({ database, backups } = await startAnew());
  sources.advance(60_000);
  const second = await backups.restore(older!.id);
  ({ database, backups } = await startAnew());

  // The newest Backup of a kind per day stays: the one from before the first restore, which
  // held "third", went when the second restore took its own.
  const kept = (await backups.list()).map(({ id }) => id);
  expect(kept).toContain(second.status === "restored" ? second.replaced.id : "");
  expect(kept).not.toContain(first.status === "restored" ? first.replaced.id : "");
  await expect(notes(database)).resolves.toEqual(["first"]);
});

test("from the moment a restore is staged the database refuses writes, and still reads", async () => {
  const { database, backups } = await start();
  const backup = await backups.create();
  sources.advance(1000);

  await backups.restore(backup.id);

  await expect(
    write(database, "written into a database that is about to be replaced"),
  ).rejects.toThrow(/readonly/);
  await expect(notes(database)).resolves.toEqual(["first"]);
  // The Backups go on: they only read the database.
  sources.advance(1000);
  await expect(backups.create()).resolves.toMatchObject({ kind: "manual" });
});

test("a write that waits while a restore runs is refused, not lost", async () => {
  const { database, backups } = await start();
  const backup = await backups.create();
  sources.advance(1000);
  let written: Promise<void> | undefined;
  const whileRestoring = createBackups({
    database: {
      ...database,
      // The Backup of the replaced data: a write that arrives now would not be in it.
      async backupTo(destination) {
        await database.backupTo(destination);
        written = write(database, "arrived during the restore");
        written.catch(() => {
          // Awaited below.
        });
      },
    },
    databasePath,
    directory,
    clock: sources.clock,
  });

  const outcome = await whileRestoring.restore(backup.id);

  await expect(written).rejects.toThrow(/readonly/);
  const replaced = outcome.status === "restored" ? outcome.replaced.id : "";
  await expect(notes(open(backupFile(replaced)))).resolves.toEqual(["first"]);
});

test.each([
  ["a Backup that is gone", () => "2026-01-01T12-00-00-000Z-daily", "notFound"],
  ["a Backup that cannot be read", (id: string) => id, "unreadable"],
] as const)(
  "after a restore of %s the database takes writes again",
  async (_what, idOf, status) => {
    const { database, backups } = await start();
    const backup = await backups.create();
    if (status === "unreadable") writeFileSync(backupFile(backup.id), "no database".repeat(900));

    await expect(backups.restore(idOf(backup.id))).resolves.toEqual({ status });

    await expect(write(database, "second")).resolves.toBeUndefined();
  },
);

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

  // This database stays, so it takes writes again.
  await expect(write(database, "second")).resolves.toBeUndefined();
  await closeAll();
  expect(applyStagedRestore(databasePath)).toBe(false);
  await expect(notes(open(databasePath))).resolves.toEqual(["first", "second"]);
});

test("a restore that fails after another was staged leaves that one staged and the writes refused", async () => {
  const { database } = await start();
  let full = false;
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
  const backup = await backups.create();
  sources.advance(1000);
  await backups.restore(backup.id);
  sources.advance(1000);
  full = true;

  await expect(backups.restore(backup.id)).rejects.toThrow("The disk is full");

  await expect(
    write(database, "written into a database that is about to be replaced"),
  ).rejects.toThrow(/readonly/);
  await closeAll();
  expect(applyStagedRestore(databasePath)).toBe(true);
});

test("a restore whose copy cannot be staged leaves no half staged copy behind", async () => {
  const { database, backups } = await start();
  const backup = await backups.create();
  // The copy takes over that it cannot be written, so writing it through to the disk fails.
  chmodSync(backupFile(backup.id), 0o444);

  await expect(backups.restore(backup.id)).rejects.toThrow();

  expect(readdirSync(folder)).not.toContain("self-engine.sqlite.restore.partial");
  // This database stays, so it takes writes again.
  await expect(write(database, "second")).resolves.toBeUndefined();
});

test("a Backup that fails leaves no half written file behind", async () => {
  const { database } = await start();
  const backups = createBackups({
    database: {
      ...database,
      // The copy breaks off halfway, as on a disk that fills.
      backupTo: (destination) => {
        writeFileSync(destination, "half");
        return Promise.reject(new Error("The disk is full"));
      },
    },
    databasePath,
    directory,
    clock: sources.clock,
  });

  await expect(backups.create()).rejects.toThrow("The disk is full");

  expect(readdirSync(directory)).toEqual([]);
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

/** Backups whose disk is full while `full.now` is true. */
function onADiskThatFills(database: Database) {
  const full = { now: true };
  const backups = createBackups({
    database: {
      ...database,
      backupTo: (destination) =>
        full.now ? Promise.reject(new Error("The disk is full")) : database.backupTo(destination),
    },
    databasePath,
    directory,
    clock: sources.clock,
  });
  return { full, backups };
}

test("a daily Backup that fails is remembered until an automatic Backup succeeds", async () => {
  const { database } = await start();
  const { full, backups } = onADiskThatFills(database);
  expect(backups.automaticBackupFailed()).toBe(false);

  await expect(backups.backUpIfDue()).rejects.toThrow("The disk is full");
  expect(backups.automaticBackupFailed()).toBe(true);
  // The next hour asks again and fails again.
  await expect(backups.backUpIfDue()).rejects.toThrow("The disk is full");
  expect(backups.automaticBackupFailed()).toBe(true);

  full.now = false;
  await expect(backups.backUpIfDue()).resolves.toMatchObject({ kind: "daily" });
  expect(backups.automaticBackupFailed()).toBe(false);
});

test("a Backup taken by hand clears a remembered failure: the data is protected again", async () => {
  const { database } = await start();
  const { full, backups } = onADiskThatFills(database);
  await expect(backups.backUpIfDue()).rejects.toThrow("The disk is full");

  full.now = false;
  await backups.create();

  expect(backups.automaticBackupFailed()).toBe(false);
});

test("a Backup by hand that fails is not remembered: its caller is told", async () => {
  const { database } = await start();
  const { backups } = onADiskThatFills(database);

  await expect(backups.create()).rejects.toThrow("The disk is full");

  expect(backups.automaticBackupFailed()).toBe(false);
});

test("a Backup before migrations that fails is remembered too", async () => {
  const { database } = await start();
  const { backups } = onADiskThatFills(database);

  await expect(backups.backUpBeforeMigrations()).rejects.toThrow("The disk is full");

  expect(backups.automaticBackupFailed()).toBe(true);
});
