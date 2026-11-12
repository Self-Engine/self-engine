import type { QueryTables } from "@self-engine/contracts";
import type { DataModules } from "./modules.ts";

/**
 * Each Query of the mounted modules with the tables it declares it reads (D248), built once at
 * start and sent with the opening event of every Table Change stream. Operations are left out.
 */
export function queryTables(modules: DataModules): QueryTables {
  return Object.fromEntries(
    Object.entries(modules).map(([name, module]) => [
      name,
      Object.fromEntries(
        Object.entries(module.entries).flatMap(([entry, definition]) =>
          definition.kind === "query" ? [[entry, [...definition.reads]]] : [],
        ),
      ),
    ]),
  );
}
