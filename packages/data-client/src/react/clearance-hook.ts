import type { ClearanceWrite, RowClearance } from "@self-engine/data-protocol";
import { useEffect, useRef, useState } from "react";
import { useDataContext } from "./provider.ts";

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

export type ClearanceState =
  | { readonly status: "loading" }
  | { readonly status: "loadFailed" }
  | { readonly status: "content"; readonly data: readonly RowClearance[] };

/**
 * Takes one Clearance when mounted (D336, D339). An open form keeps its answer through Table
 * Changes and reconnects. Mount anew for another row or another opening of the same form.
 */
export function useClearance(input: ClearanceQuery): ClearanceState {
  const { access } = useDataContext();
  const [opening] = useState(() => ({ access, input }));
  const inFlight = useRef<Promise<unknown> | undefined>(undefined);
  const [state, setState] = useState<ClearanceState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    // Strict Mode replays the effect. Both setups listen to the same call.
    inFlight.current ??= opening.access.call("", "clearance", opening.input);
    void inFlight.current.then(
      (data) => {
        // The protocol types the answer that crossed the Port.
        if (active) setState({ status: "content", data: data as RowClearance[] });
      },
      () => {
        // The caller can render loadFailed; the Operation still enforces the same rules.
        if (active) setState({ status: "loadFailed" });
      },
    );
    return () => {
      active = false;
    };
  }, [opening]);
  return state;
}
