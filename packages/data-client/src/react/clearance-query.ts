import type {
  ArchivableTable,
  ClearanceWrite,
  RowId,
  SyncedTable,
} from "@self-engine/data-protocol";

type NonEmpty<Value> = readonly [Value, ...Value[]];

interface ClearanceInput<
  Table extends string = string,
  Id extends string = string,
  Write extends ClearanceWrite = ClearanceWrite,
> {
  readonly table: Table;
  readonly rows: NonEmpty<Id>;
  readonly writes: NonEmpty<Write>;
}

declare const checkedQuery: unique symbol;

/** A Clearance Query checked against the tables of the calling module. */
export type ClearanceQuery = ClearanceInput & { readonly [checkedQuery]: true };

/** One Query per synced table, with its ids, and archive and unarchive only where it archives. */
type ModuleClearanceQuery<Tables> = {
  [Table in SyncedTable<Tables>]: ClearanceInput<
    Table,
    RowId<Tables, Table> & string,
    Table extends ArchivableTable<Tables>
      ? ClearanceWrite
      : Exclude<ClearanceWrite, "archive" | "unarchive">
  >;
}[SyncedTable<Tables>];

/** Bind queries to a module's synced tables and their branded ids, given its TablesOf<RowMap>. */
export function clearanceQueryFor<Tables>() {
  return <const Query extends ModuleClearanceQuery<Tables>>(query: Query): Query & ClearanceQuery =>
    query as Query & ClearanceQuery;
}
