// A restore in two steps, because a database cannot be replaced while a process has it open: the
// running Data Process stages the Backup beside the database, and the next one puts it in place
// before it opens anything. A crash between the two loses nothing: the staged file is applied by
// whichever start comes next.

import { existsSync, renameSync, rmSync } from "node:fs";
import { copyFile, open, rename, rm } from "node:fs/promises";

/** Where a restore waits for the next start of the Data Process. */
export function stagedRestoreFile(databasePath: string): string {
  return `${databasePath}.restore`;
}

/** The copy while it is written: never applied, so a crash halfway restores nothing. */
function unfinishedStageFile(databasePath: string): string {
  return `${stagedRestoreFile(databasePath)}.partial`;
}

export interface UnfinishedStage {
  /** Makes the copy the staged restore, in one step: from now on the next start applies it. */
  commit(): Promise<void>;
  /** Removes the copy: nothing is restored. */
  discard(): Promise<void>;
}

/**
 * Copies the file `source`, a Backup, beside the database and writes it through to the disk. It
 * is no staged restore until `commit`, so what has to succeed first can still fail.
 */
export async function stageRestore(source: string, databasePath: string): Promise<UnfinishedStage> {
  const unfinished = unfinishedStageFile(databasePath);
  await copyFile(source, unfinished);
  // The next start trusts a staged file as it is, so its bytes are on the disk before its name.
  const handle = await open(unfinished, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  return {
    commit: () => rename(unfinished, stagedRestoreFile(databasePath)),
    discard: () => rm(unfinished, { force: true }),
  };
}

/**
 * Puts a staged restore in the database's place and says whether there was one. Call it before
 * the database is opened, while no process has the file open.
 */
export function applyStagedRestore(databasePath: string): boolean {
  rmSync(unfinishedStageFile(databasePath), { force: true });
  const staged = stagedRestoreFile(databasePath);
  if (!existsSync(staged)) return false;
  // First, and before the rename: the write-ahead log belongs to the database that is replaced,
  // and SQLite would replay it into the restored one.
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  renameSync(staged, databasePath);
  return true;
}
