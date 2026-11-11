// The data process: an Electron `utilityProcess` that owns the database (D90). The main process's
// supervisor (data-process-supervisor.ts) starts it with the database file as an argument.

import type { Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { databasePathFromArgs } from "./data-process-messages.ts";
import { runDataProcess } from "./data-process-runtime.ts";

// Every module's migrations, composed here (D135). No module has any yet.
const migrations: readonly Migration[] = [];

function fail(error: unknown): void {
  console.error("The data process failed to start", error);
  process.exit(1);
}

try {
  const database = openDatabase(databasePathFromArgs(process.argv));
  runDataProcess({ parentPort: process.parentPort, database, migrations }).catch(fail);
} catch (error) {
  fail(error);
}
