import type { Kysely } from "kysely";

/** An open SQLite database. One driver entry point of this package creates it. */
export interface Database {
  /** The query layer over this database's one connection. */
  readonly kysely: Kysely<unknown>;
  /**
   * Runs SQL that may hold several statements, on the same connection as `kysely`, so it joins
   * an open transaction. Kysely itself runs one statement per query.
   */
  executeScript(sql: string): Promise<void>;
  /**
   * Writes a consistent copy of the whole database to a new file at `destination`, through
   * SQLite's own backup and not a copy of the file, so calls and writes go on meanwhile (D94).
   * The copy is one file without side files, whatever journal the database itself keeps.
   */
  backupTo(destination: string): Promise<void>;
  close(): Promise<void>;
}
