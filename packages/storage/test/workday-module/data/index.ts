// Test-only reference for reading a Setting (D352); no runtime entry imports it.
import { defineStorageModule, SETTINGS_TABLE } from "../../../src/core/index.ts";
import { workdayContract, workdayHours } from "../contracts/index.ts";

/** A module without a table of its own, whose Query answers with a Setting. */
export const workday = defineStorageModule({
  name: "workday",
  contract: workdayContract,
  migrations: [],
  rowMap: {},
}).entries({
  hours: {
    kind: "query",
    // The read of a Setting is a read of the Settings table: a change of it reloads this Query.
    reads: [SETTINGS_TABLE],
    run: (tx, context) => context.readSetting(tx, workdayHours),
  },
});
