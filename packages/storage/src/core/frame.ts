import { ContractProcedure, type AnySchema, type ErrorMap, type Meta } from "@orpc/contract";
import { z } from "zod";
import { implement, type ImplementedProcedure } from "@orpc/server";
import type { Database, TablesOf } from "@self-engine/db";
import { createContext, type ContextSources } from "./context.ts";
import { reportLargeResult, type LargeResultReport } from "./large-result.ts";
import { recordTableWrites } from "./table-writes.ts";
import type { RowMap, StorageContract, StorageModule } from "./module.ts";

export type StorageReport = LargeResultReport;

export interface FrameOptions {
  readonly database: Database;
  readonly sources: ContextSources;
  readonly checkOutputs: boolean;
  readonly report?: (value: StorageReport) => void;
  /** Called once after commit when at least one table was written; never for queries. */
  readonly announce?: (tables: ReadonlySet<string>) => void | Promise<void>;
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

/** Built once, with validation inside the transaction and announcements only after commit. */
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
          .use(async ({ next }) => {
            const tables = new Set<string>();
            const result = await options.database.kysely
              .transaction()
              .execute(async (transaction) => {
                const context = createContext(options.sources);
                const tx = transaction
                  .withTables<TablesOf<Rows>>()
                  .withPlugin(recordTableWrites(tables, entry.kind === "query"));
                return next({ context: { tx, storageContext: context } });
              });
            if (entry.kind === "operation" && tables.size > 0) await options.announce?.(tables);
            return result;
          })
          .handler(async ({ context, input }) => {
            const output = await entry.run(context.tx, context.storageContext, input);
            if (options.checkOutputs && entry.kind === "query") {
              reportLargeResult(name, entry.list?.kind, output, options.report);
            }
            return output;
          }),
      ];
    }),
  );
  // The dynamic traversal preserves each contract entry's input/output types.
  return router as FrameRouter<Contract>;
}
