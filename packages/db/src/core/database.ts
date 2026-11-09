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
  close(): Promise<void>;
}
