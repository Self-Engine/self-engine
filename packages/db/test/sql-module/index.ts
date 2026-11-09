import { defineMigrations } from "../../src/core/index.ts";

// How a module hands over its numbered SQL files.
export const sqlModuleMigrations = defineMigrations(
  "sql-module",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

// A side effect, since a build drops an entry's unused exports.
Object.assign(globalThis, { sqlModuleMigrations });
