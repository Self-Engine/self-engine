import type { ClearanceWrite } from "@self-engine/data-protocol";

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

type ModuleClearanceQuery<Tables> = {
  [Table in keyof Tables & string]: Table extends `local_${string}`
    ? never
    : Tables[Table] extends { id: infer Id extends string }
      ? ClearanceInput<
          Table,
          Id,
          "archived_at" extends keyof Tables[Table]
            ? ClearanceWrite
            : Exclude<ClearanceWrite, "archive" | "unarchive">
        >
      : never;
}[keyof Tables & string];

/** Bind queries to a module's synced tables and their branded ids, given its TablesOf<RowMap>. */
export function clearanceQueryFor<Tables>() {
  return <const Query extends ModuleClearanceQuery<Tables>>(query: Query): Query & ClearanceQuery =>
    query as Query & ClearanceQuery;
}
