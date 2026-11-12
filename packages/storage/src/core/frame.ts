import { ContractProcedure, type AnySchema, type ErrorMap, type Meta } from "@orpc/contract";
import { z } from "zod";
import { implement, ORPCError, type ImplementedProcedure } from "@orpc/server";
import { uniqueIndexes, type Database, type TablesOf } from "@self-engine/db";
import { createContext, type ContextSources } from "./context.ts";
import { recordTableWrites } from "./table-writes.ts";
import type { RowMap, StorageContract, StorageModule } from "./module.ts";

export type FrameReport = {
  readonly kind: "unexpected-error";
  readonly entry: string;
  readonly error: unknown;
  readonly index?: string;
};

export interface FrameOptions {
  readonly database: Database;
  readonly sources: ContextSources;
  readonly checkOutputs: boolean;
  readonly report?: (report: FrameReport) => void;
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
            let result;
            try {
              result = await options.database.kysely.transaction().execute(async (transaction) => {
                const context = createContext(options.sources);
                const tx = transaction
                  .withTables<TablesOf<Rows>>()
                  .withPlugin(recordTableWrites(tables, entry.kind === "query"));
                return next({ context: { tx, storageContext: context } });
              });
            } catch (error) {
              if (
                error instanceof ORPCError &&
                (error.code === "NOT_FOUND" || error.code === "CONFLICT")
              )
                throw error;
              let index: string | undefined;
              if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
                error instanceof Error
              ) {
                const diagnostic = error.message.replace(/^UNIQUE constraint failed: /, "");
                const indexes = await uniqueIndexes(options.database, Object.keys(module.rowMap));
                const matches = indexes.filter(
                  (candidate) =>
                    candidate.columns === diagnostic || diagnostic === `index '${candidate.name}'`,
                );
                if (matches.length === 1) index = matches[0]?.name;
                const reason = index === undefined ? undefined : module.conflicts?.[index];
                if (reason !== undefined) throw new ORPCError("CONFLICT", { data: { reason } });
              }
              try {
                options.report?.({
                  kind: "unexpected-error",
                  entry: name,
                  error,
                  ...(index === undefined ? {} : { index }),
                });
              } catch (reportError) {
                // A reporting sink cannot change the operation's failure.
                void reportError;
              }
              throw new ORPCError("INTERNAL_SERVER_ERROR");
            }
            if (entry.kind === "operation" && tables.size > 0) await options.announce?.(tables);
            return result;
          })
          .handler(({ context, input }) => entry.run(context.tx, context.storageContext, input)),
      ];
    }),
  );
  // The dynamic traversal preserves each contract entry's input/output types.
  return router as FrameRouter<Contract>;
}
