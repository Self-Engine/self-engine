import type { AnyContractProcedure, InferSchemaInput, InferSchemaOutput } from "@orpc/contract";
import type { Migration, TablesOf } from "@self-engine/db";
import type { refusal } from "@self-engine/db/schema";
import type { Transaction, CompiledQuery } from "kysely";
import type { z } from "zod";
import type { StorageContext } from "./context.ts";
import type { SyncedTable } from "./convention.ts";
import type { RegisteredRule } from "./registry.ts";

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
/**
 * Whether a Contract entry carries the Refusal through the shared building block `refusal`; for
 * the wide procedure type of code generic over every module, either.
 */
type CarriesRefusal<Procedure extends AnyContractProcedure> =
  string extends keyof Procedure["~orpc"]["errorMap"]
    ? boolean
    : Procedure["~orpc"]["errorMap"] extends { readonly REFUSED: typeof refusal.REFUSED }
      ? true
      : false;
/**
 * An entry whose Contract carries the Refusal is an Operation, one without it a Query (D334): an
 * Operation that lacks `...refusal` in its `.errors()` does not compile as `kind: "operation"`.
 * The contract kit checks the same at runtime, against the building block itself.
 */
export type ModuleEntries<Contract extends StorageContract, Rows extends RowMap> = {
  readonly [Entry in keyof Contract]: CarriesRefusal<Contract[Entry]> extends true
    ? OperationEntry<Contract[Entry], Rows>
    : CarriesRefusal<Contract[Entry]> extends false
      ? QueryEntry<Contract[Entry], Rows>
      : QueryEntry<Contract[Entry], Rows> | OperationEntry<Contract[Entry], Rows>;
};
type QueryEntry<Procedure extends AnyContractProcedure, Rows extends RowMap> = {
  readonly kind: "query";
  /**
   * Every table the query takes rows from, including tables reached through a released read
   * piece. A Table Change naming one of them makes its answer outdated (D248).
   */
  readonly reads: readonly string[];
  /**
   * Declares to the contract kit that the answer holds no archived row (D327): the kit archives
   * the seeded rows and fails the Query if one of them is still in its answer.
   */
  readonly active?: true;
  readonly list?:
    | { readonly kind: "window" | "small-set" }
    | {
        readonly kind: "pages";
        readonly queries: Handler<
          ReadTransaction<TablesOf<Rows>>,
          InferSchemaOutput<Procedure["~orpc"]["inputSchema"]>,
          readonly CompiledQuery[]
        >;
      };
  readonly run: Handler<
    ReadTransaction<TablesOf<Rows>>,
    InferSchemaOutput<Procedure["~orpc"]["inputSchema"]>,
    InferSchemaInput<Procedure["~orpc"]["outputSchema"]>
  >;
};
type OperationEntry<Procedure extends AnyContractProcedure, Rows extends RowMap> = {
  readonly kind: "operation";
  /**
   * Declares the Operation an edit (D329, ADR 0032): its input is the id and optional fields, as
   * `entryFields` derives it, and the contract kit checks the edit pattern.
   */
  readonly edit?: true;
  readonly run: Handler<
    Transaction<TablesOf<Rows>>,
    InferSchemaOutput<Procedure["~orpc"]["inputSchema"]>,
    InferSchemaInput<Procedure["~orpc"]["outputSchema"]>
  >;
};
export interface StorageModule<
  Contract extends StorageContract,
  Rows extends RowMap,
  Name extends string = string,
> {
  /**
   * The module's namespace in the app contract; page cursors carry it (D259). Kept as its
   * literal, so the app's module list can require it to equal the key it is mounted under.
   */
  readonly name: Name;
  readonly contract: Contract;
  readonly migrations: readonly Migration[];
  readonly rowMap: Rows;
  readonly entries: ModuleEntries<Contract, Rows>;
  /** Unique index name to the reason code declared by the contract. */
  readonly conflicts?: Readonly<Record<string, string>>;
  /** Protection Rules for the module's own tables, each stated with `protectionRule` (D331). */
  readonly rules?: readonly RegisteredRule<SyncedTable<TablesOf<Rows>>>[];
}

/** Everything a module declares before its entries: name, Contract, row map and migrations. */
export type StorageModuleDefinition<
  Contract extends StorageContract,
  Rows extends RowMap,
  Name extends string = string,
> = Omit<StorageModule<Contract, Rows, Name>, "entries">;

/**
 * Defines a module in two steps (refines D259): the Contract and row map are fixed first, so
 * the entries, including list builders, take `tx` and `input` from them without written types.
 */
export function defineStorageModule<
  const Contract extends StorageContract,
  const Rows extends RowMap,
  const Name extends string,
>(definition: StorageModuleDefinition<Contract, Rows, Name>) {
  return {
    entries<const Entries extends ModuleEntries<Contract, Rows>>(
      entries: Entries,
    ): StorageModule<Contract, Rows, Name> & { readonly entries: Entries } {
      return { ...definition, entries };
    },
  };
}

// Heterogeneous module collections erase lower-function parameter types only after
// defineStorageModule checked each module against its own contract and row map.
export type ErasedStorageModule = Pick<
  StorageModule<StorageContract, RowMap>,
  "name" | "contract" | "migrations" | "rowMap" | "conflicts"
> & {
  readonly rules?: readonly RegisteredRule[];
  readonly entries: Readonly<
    Record<
      string,
      | {
          readonly kind: "query";
          readonly reads: readonly string[];
          readonly active?: true;
          readonly list?: { readonly kind: "window" | "small-set" | "pages" };
          readonly run: (...args: never[]) => unknown;
        }
      | {
          readonly kind: "operation";
          readonly edit?: true;
          readonly run: (...args: never[]) => unknown;
        }
    >
  >;
};
