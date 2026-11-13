import type { QueryTables } from "@self-engine/data-protocol";
import type { DataModules } from "./modules.ts";

/**
 * The protocol's own Queries. The list of Backups reads no table: Backups are files, so no Table
 * Change answers it again, and the page reloads it after an Operation on them itself (D250).
 */
const PROTOCOL_QUERIES: QueryTables = { backups: { list: [] } };

/**
 * Each Query of the mounted modules with the tables it declares it reads (D248), and the
 * protocol's own, built once at start and sent with the opening event of every Table Change
 * stream. Operations are left out.
 */
export function queryTables(modules: DataModules): QueryTables {
  return {
    ...Object.fromEntries(
      Object.entries(modules).map(([name, module]) => [
        name,
        Object.fromEntries(
          Object.entries(module.entries).flatMap(([entry, definition]) =>
            definition.kind === "query" ? [[entry, [...definition.reads]]] : [],
          ),
        ),
      ]),
    ),
    ...PROTOCOL_QUERIES,
  };
}
