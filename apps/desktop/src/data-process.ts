// The data process: an Electron `utilityProcess` that owns the database (D90). The main process's
// supervisor (data-process-supervisor.ts) starts it with the database file as an argument.

import { dataModules } from "./data-modules.ts";
import { dataProcessOptions } from "./data-process-options.ts";
import { databasePathFromArgs } from "./data-process-messages.ts";
import { openDataFiles, runDataProcess } from "./data-process-runtime.ts";

function fail(error: unknown): void {
  console.error("The data process failed to start", error);
  process.exit(1);
}

try {
  runDataProcess({
    parentPort: process.parentPort,
    ...openDataFiles(databasePathFromArgs(process.argv)),
    modules: dataModules,
    ...dataProcessOptions,
  }).catch(fail);
} catch (error) {
  fail(error);
}
