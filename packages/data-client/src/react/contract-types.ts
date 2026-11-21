import type { InputErrorReason } from "@self-engine/data-protocol";
import type {
  AnyContractProcedure,
  AnyContractRouter,
  AnySchema,
  InferContractRouterInputs,
  InferContractRouterOutputs,
  InferSchemaOutput,
} from "@orpc/contract";

/** A module's Contract: its entries by name, each an oRPC contract procedure. */
export type ModuleContract = AnyContractRouter & Readonly<Record<string, AnyContractRouter>>;

/** The entry names of a Contract a hook may name. */
export type EntryName<Contract extends ModuleContract> = keyof Contract & string;

export type InputOf<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = InferContractRouterInputs<Contract[Entry]>;

export type OutputOf<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = InferContractRouterOutputs<Contract[Entry]>;

/**
 * The conflict reasons the entry declares: the `reason` of its `CONFLICT` data, as the storage
 * frame sends it. `never` for an entry without a conflict.
 */
export type ConflictReasonOf<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = Contract[Entry] extends AnyContractProcedure
  ? Contract[Entry]["~orpc"]["errorMap"] extends {
      readonly CONFLICT: { readonly data: infer Data extends AnySchema };
    }
    ? InferSchemaOutput<Data> extends { readonly reason: infer Reason extends string }
      ? Reason
      : never
    : never
  : never;

/**
 * The reasons of the input errors a Contract entry declares with `inputErrors` (D369): the
 * reasons its Operation raises for a limit only the Data Process can judge. `never` for an entry
 * without them, and for a procedure type that is not one entry.
 */
export type DeclaredInputReason<Procedure> = Procedure extends AnyContractProcedure
  ? Procedure["~orpc"]["errorMap"] extends { readonly BAD_REQUEST: { readonly data: infer Data } }
    ? InputErrorReason<Data>
    : never
  : never;

/** The reasons of the input errors the entry `Entry` of the Contract declares. */
export type InputReasonOf<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = DeclaredInputReason<Contract[Entry]>;

/**
 * Whether the entry carries the shared `refusal` block, as every Operation does (D334): only such
 * an entry may be refused. `false` for a Query.
 */
export type CarriesRefusal<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = Contract[Entry] extends AnyContractProcedure
  ? Contract[Entry]["~orpc"]["errorMap"] extends { readonly REFUSED: unknown }
    ? true
    : false
  : false;
