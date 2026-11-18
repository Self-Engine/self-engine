import type { Instant } from "@self-engine/time";
import type { z } from "zod";

/** A module's row schemas by their SQL table names. */
export type RowMap = Readonly<Record<string, z.ZodObject>>;

/** Kysely tables derived from a module's SQL-named row schemas, including their brands. */
export type TablesOf<Map extends RowMap> = {
  [Table in keyof Map]: z.output<Map[Table]>;
};

/** The convention columns of every synchronized table. */
export interface Convention {
  id: string;
  space_id: string;
  created_at: Instant;
  updated_at: Instant;
  deleted_at: Instant | null;
}

/** The synchronized tables of these tables: every one with the convention columns, no local one. */
export type SyncedTable<DB> = {
  [Table in keyof DB & string]: Table extends `local_${string}`
    ? never
    : DB[Table] extends Convention
      ? Table
      : never;
}[keyof DB & string];

/** The optional convention column of an archivable table (D327): an Instant or empty. */
export interface Archivable {
  archived_at: Instant | null;
}

export type ArchivableTable<DB> = {
  [Table in SyncedTable<DB>]: DB[Table] extends Archivable ? Table : never;
}[SyncedTable<DB>];

/** The id of a row of a synchronized table, with its brand. */
export type RowId<DB, Table extends keyof DB> = DB[Table] extends Convention
  ? DB[Table]["id"]
  : never;

export type ConventionKey = keyof Convention | keyof Archivable;
