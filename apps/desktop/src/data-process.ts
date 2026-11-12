// The data process: an Electron `utilityProcess` that owns the database (D90). The main process's
// supervisor (data-process-supervisor.ts) starts it with the database file as an argument.

import { openDatabase } from "@self-engine/db/better-sqlite3";
import { dataProcessOptions } from "./data-process-options.ts";
import { databasePathFromArgs } from "./data-process-messages.ts";
import { runDataProcess } from "./data-process-runtime.ts";

function fail(error: unknown): void {
  console.error("The data process failed to start", error);
  process.exit(1);
}

try {
  const database = openDatabase(databasePathFromArgs(process.argv));
  runDataProcess({ parentPort: process.parentPort, database, ...dataProcessOptions }).catch(fail);
} catch (error) {
  fail(error);
}
