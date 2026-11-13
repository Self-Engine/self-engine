// The data process: an Electron `utilityProcess` that owns the database (D90). The main process's
// supervisor (data-process-supervisor.ts) starts it with the database file as an argument.

import { systemClock } from "@self-engine/time/system-clock";
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
    ...openDataFiles(databasePathFromArgs(process.argv), systemClock),
    sources: {
      clock: systemClock,
      ids: { clock: systemClock, random: () => crypto.getRandomValues(new Uint8Array(16)) },
    },
    modules: dataModules,
    ...dataProcessOptions,
  }).catch(fail);
} catch (error) {
  fail(error);
}
