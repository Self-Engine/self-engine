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
