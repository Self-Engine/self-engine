import type { AnyContractProcedure, InferSchemaInput, InferSchemaOutput } from "@orpc/contract";
import type { Migration, TablesOf } from "@self-engine/db";
import type { Transaction } from "kysely";
import type { z } from "zod";
import type { StorageContext } from "./context.ts";

export type StorageContract = Readonly<Record<string, AnyContractProcedure>>;
export type RowMap = Readonly<Record<string, z.ZodObject>>;
export type ReadTransaction<Rows> = Pick<Transaction<Rows>, "selectFrom" | "selectNoFrom">;
type Handler<Tx, Input, Output> = (
  tx: Tx,
  context: StorageContext,
  input: Input,
) => Output | Promise<Output>;
export type ModuleEntries<Contract extends StorageContract, Rows extends RowMap> = {
  readonly [Entry in keyof Contract]:
    | {
        readonly kind: "query";
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
  readonly contract: Contract;
  readonly migrations: readonly Migration[];
  readonly rowMap: Rows;
  readonly entries: ModuleEntries<Contract, Rows>;
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
