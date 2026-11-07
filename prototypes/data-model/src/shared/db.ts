import Database from "better-sqlite3";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type DB = Database.Database;

/** Opens a fresh file database with the pragmas a desktop (Electron) app would use. */
export function openFresh(path: string): DB {
  mkdirSync(dirname(path), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(path + suffix)) rmSync(path + suffix);
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -65536"); // 64 MiB page cache
  return db;
}

export function sqliteVersion(db: DB): string {
  return (db.prepare("select sqlite_version() v").get() as { v: string }).v;
}

/** Database size on disk after folding the WAL back into the main file. */
export function fileSizeBytes(db: DB): number {
  db.pragma("wal_checkpoint(TRUNCATE)");
  const pageCount = db.pragma("page_count", { simple: true }) as number;
  const pageSize = db.pragma("page_size", { simple: true }) as number;
  return pageCount * pageSize;
}
