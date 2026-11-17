import { ORPCError } from "@orpc/server";
import { isLocalTable, type Database } from "@self-engine/db";
import {
  clearance,
  createContext,
  type ContextSources,
  type ErasedStorageModule,
} from "@self-engine/storage";
import { implementer } from "../implementer.ts";

export interface ClearanceOptions {
  readonly database: Database;
  /** The sources of every frame's context; absent in a failure state, where no call is served. */
  readonly sources: ContextSources | undefined;
  readonly modules: readonly ErasedStorageModule[];
  /** Where a failure nobody expected goes; it never throws. */
  readonly reportUnexpected: (entry: string, error: unknown) => void;
}

/**
 * The synced tables of the mounted modules, each with whether it can be archived (D327). A Local
 * Table has no rules and no Live Rows to ask about.
 */
function syncedTables(modules: readonly ErasedStorageModule[]) {
  return new Map(
    modules.flatMap((module) =>
      Object.entries(module.rowMap)
        .filter(([table]) => !isLocalTable(table))
        .map(([table, row]) => [table, Object.hasOwn(row.shape, "archived_at")] as const),
    ),
  );
}

/**
 * The protocol's `clearance` (D339): it only reads, in one transaction outside any frame, so it
 * announces no Table Change. The rules are those of every frame, asked through an access that
 * cannot write.
 */
export function clearanceProcedure({
  database,
  sources,
  modules,
  reportUnexpected,
}: ClearanceOptions) {
  const tables = syncedTables(modules);
  return implementer.clearance.handler(async ({ input }) => {
    const archivable = tables.get(input.table);
    if (archivable === undefined)
      throw new ORPCError("BAD_REQUEST", {
        message: `No mounted module has the synced table ${input.table}`,
      });
    if (!archivable && input.writes.some((write) => write === "archive" || write === "unarchive"))
      throw new ORPCError("BAD_REQUEST", { message: `${input.table} cannot be archived` });
    try {
      if (sources === undefined) throw new Error("The Clearance has no Space in a failure state");
      return await database.kysely
        .transaction()
        .execute((tx) =>
          clearance(tx, createContext(sources), input.table, input.writes, input.rows),
        );
    } catch (error) {
      reportUnexpected("clearance", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
  });
}
