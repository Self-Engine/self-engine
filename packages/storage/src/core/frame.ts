import { declaresConflict } from "./conflict-declared.ts";
import { ContractProcedure, type AnySchema, type ErrorMap, type Meta } from "@orpc/contract";
import { z } from "zod";
import { implement, ORPCError, type ImplementedProcedure } from "@orpc/server";
import { uniqueIndexes, type Database, type TablesOf } from "@self-engine/db";
import { createContext, type ContextSources } from "./context.ts";
import { reportLargeResult, type LargeResultReport } from "./large-result.ts";
import { recordTableWrites } from "./table-writes.ts";
import type { RowMap, StorageContract, StorageModule, ErasedStorageModule } from "./module.ts";

export type FrameReport =
  | LargeResultReport
  | {
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

/** Input validation precedes the transaction; output checks run inside it, announcements after commit. */
export function createFrame<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  options: FrameOptions,
): FrameRouter<Contract>;
export function createFrame(
  module: ErasedStorageModule,
  options: FrameOptions,
): FrameRouter<StorageContract>;
export function createFrame(
  erasedModule: ErasedStorageModule,
  options: FrameOptions,
): FrameRouter<StorageContract> {
  // Module definitions check the lower functions before heterogeneous collections erase them.
  const module = erasedModule as StorageModule<StorageContract, RowMap>;
  function reportUnexpected(entry: string, error: unknown, index?: string) {
    try {
      options.report?.({
        kind: "unexpected-error",
        entry,
        error,
        ...(index === undefined ? {} : { index }),
      });
    } catch (reportError) {
      // Reporting cannot change a committed result or the original failure.
      void reportError;
    }
  }
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
                  .withTables<TablesOf<RowMap>>()
                  .withPlugin(recordTableWrites(tables, entry.kind === "query"));
                return next({ context: { tx, storageContext: context } });
              });
            } catch (error) {
              if (
                error instanceof ORPCError &&
                (error.code === "BAD_REQUEST" ||
                  error.code === "NOT_FOUND" ||
                  error.code === "CONFLICT")
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
                let indexes: Awaited<ReturnType<typeof uniqueIndexes>> = [];
                try {
                  indexes = await uniqueIndexes(options.database, Object.keys(module.rowMap));
                } catch (diagnosticError) {
                  // Diagnostics must not replace the original database failure.
                  void diagnosticError;
                }
                const matches = indexes.filter(
                  (candidate) =>
                    candidate.columns === diagnostic || diagnostic === `index '${candidate.name}'`,
                );
                if (matches.length === 1) index = matches[0]?.name;
                const reasons = matches.map((candidate) => module.conflicts?.[candidate.name]);
                const reason =
                  reasons.length > 0 &&
                  reasons.every((reason) => reason !== undefined && reason === reasons[0])
                    ? reasons[0]
                    : undefined;
                if (reason !== undefined) {
                  const conflict = new ORPCError("CONFLICT", { data: { reason } });
                  if (
                    options.checkOutputs &&
                    !(await declaresConflict(module.contract[name]!, conflict))
                  )
                    reportUnexpected(name, conflict, index);
                  throw conflict;
                }
              }
              reportUnexpected(name, error, index);
              throw new ORPCError("INTERNAL_SERVER_ERROR");
            }
            if (entry.kind === "operation" && tables.size > 0) {
              try {
                await options.announce?.(tables);
              } catch (error) {
                reportUnexpected(name, error);
              }
            }
            return result;
          })
          .handler(async ({ context, input }) => {
            const output = await entry.run(context.tx, context.storageContext, input, name);
            if (options.checkOutputs && entry.kind === "query") {
              reportLargeResult(name, entry.list?.kind, output, options.report);
            }
            return output;
          }),
      ];
    }),
  );
  // The dynamic traversal preserves each contract entry's input/output types.
  return router as FrameRouter<StorageContract>;
}
