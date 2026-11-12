import type { AnyContractProcedure, InferSchemaInput, InferSchemaOutput } from "@orpc/contract";
import type { Migration, TablesOf } from "@self-engine/db";
import type { Transaction, CompiledQuery } from "kysely";
import type { z } from "zod";
import type { StorageContext } from "./context.ts";

export type StorageContract = Readonly<Record<string, AnyContractProcedure>>;
export type RowMap = Readonly<Record<string, z.ZodObject>>;
export type ReadTransaction<Rows> = Pick<Transaction<Rows>, "selectFrom" | "selectNoFrom">;
type Handler<Tx, Input, Output> = (
  tx: Tx,
  context: StorageContext,
  input: Input,
  /** Stable contract key, supplied by the frame (and the kit for query plans). */
  entry: string,
  /** The module's name, supplied by the frame (and the kit for query plans). */
  module: string,
) => Output | Promise<Output>;
export type ModuleEntries<Contract extends StorageContract, Rows extends RowMap> = {
  readonly [Entry in keyof Contract]:
    | {
        readonly kind: "query";
        readonly list?:
          | { readonly kind: "window" | "small-set" }
          | {
              readonly kind: "pages";
              readonly queries: Handler<
                ReadTransaction<TablesOf<Rows>>,
                InferSchemaOutput<Contract[Entry]["~orpc"]["inputSchema"]>,
                readonly CompiledQuery[]
              >;
            };
        readonly run: Handler<
          ReadTransaction<TablesOf<Rows>>,
          InferSchemaOutput<Contract[Entry]["~orpc"]["inputSchema"]>,
          InferSchemaInput<Contract[Entry]["~orpc"]["outputSchema"]>
        >;
      }
    | {
        readonly kind: "operation";
        readonly run: Handler<
          Transaction<TablesOf<Rows>>,
          InferSchemaOutput<Contract[Entry]["~orpc"]["inputSchema"]>,
          InferSchemaInput<Contract[Entry]["~orpc"]["outputSchema"]>
        >;
      };
};
export interface StorageModule<Contract extends StorageContract, Rows extends RowMap> {
  /** The module's namespace in the app contract; page cursors carry it (D259). */
  readonly name: string;
  readonly contract: Contract;
  readonly migrations: readonly Migration[];
  readonly rowMap: Rows;
  readonly entries: ModuleEntries<Contract, Rows>;
  /** Unique index name to the reason code declared by the contract. */
  readonly conflicts?: Readonly<Record<string, string>>;
}

export function defineStorageModule<
  const Contract extends StorageContract,
  const Rows extends RowMap,
  const Entries extends ModuleEntries<Contract, Rows>,
>(
  module: StorageModule<Contract, Rows> & { readonly entries: Entries },
): StorageModule<Contract, Rows> & { readonly entries: Entries } {
  return module;
}

// Heterogeneous module collections erase lower-function parameter types only after
// defineStorageModule checked each module against its own contract and row map.
export type ErasedStorageModule = Pick<
  StorageModule<StorageContract, RowMap>,
  "name" | "contract" | "migrations" | "rowMap" | "conflicts"
> & {
  readonly entries: Readonly<
    Record<
      string,
      {
        readonly kind: "query" | "operation";
        readonly list?: { readonly kind: "window" | "small-set" | "pages" };
        readonly run: (...args: never[]) => unknown;
      }
    >
  >;
};
