import { ContractProcedure, type AnySchema, type ErrorMap, type Meta } from "@orpc/contract";
import { z } from "zod";
import { implement, type ImplementedProcedure } from "@orpc/server";
import type { Database, TablesOf } from "@self-engine/db";
import { createContext, type ContextSources } from "./context.ts";
import type { RowMap, StorageContract, StorageModule } from "./module.ts";

export interface FrameOptions {
  readonly database: Database;
  readonly sources: ContextSources;
  readonly checkOutputs: boolean;
}
type FrameRouter<Contract extends StorageContract> = {
  [Entry in keyof Contract]: Contract[Entry] extends ContractProcedure<
    infer Input extends AnySchema,
    infer Output extends AnySchema,
    infer Errors extends ErrorMap,
    infer Metadata extends Meta
  >
    ? ImplementedProcedure<
        Record<never, never>,
        Record<never, never>,
        Input,
        Output,
        Errors,
        Metadata
      >
    : never;
};

/** Built once, with validation inside the transaction so every failure rolls back. */
export function createFrame<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  options: FrameOptions,
): FrameRouter<Contract> {
  const contract = Object.fromEntries(
    Object.entries(module.contract).map(([name, procedure]) => {
      const definition = {
        ...procedure["~orpc"],
        inputSchema: procedure["~orpc"].inputSchema ?? z.undefined(),
      };
      if (options.checkOutputs) return [name, new ContractProcedure(definition)];
      const { outputSchema: _outputSchema, ...unchecked } = definition;
      return [name, new ContractProcedure(unchecked)];
    }),
  );
  // A leaf middleware wraps the handler and output check. Input validation stays before it.
  const implementation = implement(contract, { initialOutputValidationIndex: 1 });
  const router = Object.fromEntries(
    Object.entries(module.entries).map(([name, entry]) => {
      const procedure = implementation[name];
      if (procedure === undefined) throw new Error(`Missing contract entry: ${name}`);
      return [
        name,
        procedure
          .use(async ({ next }) =>
            options.database.kysely.transaction().execute(async (transaction) => {
              const context = createContext(options.sources);
              const tx = transaction.withTables<TablesOf<Rows>>();
              return next({ context: { tx, storageContext: context } });
            }),
          )
          .handler(({ context, input }) => entry.run(context.tx, context.storageContext, input)),
      ];
    }),
  );
  // The dynamic traversal preserves each contract entry's input/output types.
  return router as FrameRouter<Contract>;
}
