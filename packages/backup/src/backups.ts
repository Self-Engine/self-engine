import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Backup, BackupKind } from "@self-engine/data-protocol";
import type { Clock, Database } from "@self-engine/db";
import { isSoundDatabaseFile } from "@self-engine/db/better-sqlite3";
import { sql } from "kysely";
import { BACKUP_EXTENSION, backupId, parseBackupId } from "./backup-id.ts";
import { expiredBackups, isDailyBackupDue, RETENTION, type RetentionPolicy } from "./retention.ts";
import { stageRestore } from "./staged-restore.ts";

export interface BackupsOptions {
  /** The open database whose Backups these are. */
  readonly database: Database;
  /** The database's file: a restore is staged beside it. */
  readonly databasePath: string;
  /** The folder that holds the Backups and nothing else. It is created with the first Backup. */
  readonly directory: string;
  readonly clock: Clock;
  readonly retention?: RetentionPolicy;
}

/** What a restore ended with, as a value: the two failures are expected (D190). */
export type RestoreOutcome =
  /** The Backup is staged and replaces the database at the next start of the Data Process. */
  | { readonly status: "restored"; readonly replaced: Backup }
  /** No Backup has this id: it was pruned, or never existed. */
  | { readonly status: "notFound" }
  /** The Backup's file is no sound database any more. Nothing was staged. */
  | { readonly status: "unreadable" };

export interface Backups {
  /** Every Backup in the folder, newest first. */
  list(): Promise<Backup[]>;
  /** Takes a Backup because the user asked for one. */
  create(): Promise<Backup>;
  /**
   * Takes the Backup that protects the data from the migrations about to run. A database without
   * tables has nothing to protect and gets none: `undefined`.
   */
  backUpBeforeMigrations(): Promise<Backup | undefined>;
  /** Takes the daily Backup unless a Backup of any kind was taken today (UTC): else `undefined`. */
  backUpIfDue(): Promise<Backup | undefined>;
  /**
   * Stages the Backup `id` to replace the database at the next start of the Data Process, after
   * backing up what it replaces: `replaced` is that Backup, so a restore can be taken back.
   */
  restore(id: string): Promise<RestoreOutcome>;
}

/**
 * The Backups of one database (D94): whole copies taken through SQLite's backup, kept as files in
 * one folder and pruned after each new one. The folder is the only record: a Backup's file name
 * says when and why it was taken. One call works at a time, in the order the calls came.
 */
export function createBackups({
  database,
  databasePath,
  directory,
  clock,
  retention = RETENTION,
}: BackupsOptions): Backups {
  const fileOf = (id: string) => join(directory, `${id}${BACKUP_EXTENSION}`);

  async function list(): Promise<Backup[]> {
    const names = await readdir(directory).catch((error: unknown) => {
      // No Backup was taken yet.
      if (isMissing(error)) return [];
      throw error;
    });
    const backups: Backup[] = [];
    for (const name of names) {
      if (!name.endsWith(BACKUP_EXTENSION)) continue;
      const id = name.slice(0, -BACKUP_EXTENSION.length);
      const parsed = parseBackupId(id);
      if (parsed === undefined) continue;
      backups.push({ id, ...parsed, sizeBytes: (await stat(join(directory, name))).size });
    }
    return backups.toSorted((a, b) => (a.id < b.id ? 1 : -1));
  }

  async function take(kind: BackupKind): Promise<Backup> {
    await mkdir(directory, { recursive: true });
    const takenAt = clock();
    const id = backupId(takenAt, kind);
    const file = fileOf(id);
    if (await exists(file)) throw new Error(`A Backup named ${id} exists already`);
    // Written under another name first: the folder never lists a Backup that is half written.
    const unfinished = `${file}.partial`;
    await rm(unfinished, { force: true });
    await database.backupTo(unfinished);
    await rename(unfinished, file);
    await prune(id);
    return { id, takenAt: takenAt.toISOString(), kind, sizeBytes: (await stat(file)).size };
  }

  /**
   * Deletes what the retention no longer keeps, and whatever a crash left half written. The
   * Backup just taken stays even where a clock that was set back makes it the oldest.
   */
  async function prune(taken: string): Promise<void> {
    for (const { id } of expiredBackups(await list(), retention)) {
      if (id !== taken) await rm(fileOf(id));
    }
    for (const name of await readdir(directory)) {
      if (name.endsWith(".partial")) await rm(join(directory, name), { force: true });
    }
  }

  async function restore(id: string): Promise<RestoreOutcome> {
    // Only an id this app wrote becomes part of a path.
    if (parseBackupId(id) === undefined || !(await exists(fileOf(id)))) {
      return { status: "notFound" };
    }
    if (!isSoundDatabaseFile(fileOf(id))) return { status: "unreadable" };
    const stage = await stageRestore(fileOf(id), databasePath);
    try {
      // Last before the restore counts, so what it replaces is in this Backup to the last write.
      const replaced = await take("before-restore");
      await stage.commit();
      return { status: "restored", replaced };
    } catch (error) {
      await stage.discard();
      throw error;
    }
  }

  async function hasTables(): Promise<boolean> {
    const { rows } = await sql<{ tables: number }>`
      SELECT count(*) AS tables FROM sqlite_master WHERE type = 'table'
    `.execute(database.kysely);
    return (rows[0]?.tables ?? 0) > 0;
  }

  // One at a time: two Backups at once would prune each other's files, and a restore must not
  // stage while a Backup of what it replaces is still being written.
  let last: Promise<unknown> = Promise.resolve();
  function inTurn<Result>(work: () => Promise<Result>): Promise<Result> {
    const result = last.then(work, work);
    last = result.catch(() => undefined);
    return result;
  }

  return {
    list: () => inTurn(list),
    create: () => inTurn(() => take("manual")),
    backUpBeforeMigrations: () =>
      inTurn(async () => ((await hasTables()) ? take("before-migration") : undefined)),
    backUpIfDue: () =>
      inTurn(async () => (isDailyBackupDue(await list(), clock()) ? take("daily") : undefined)),
    restore: (id) => inTurn(() => restore(id)),
  };
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
