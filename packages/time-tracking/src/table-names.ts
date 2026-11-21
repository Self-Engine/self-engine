import { msg, plural } from "@lingui/core/macro";
import type { TableNames } from "@self-engine/data-client/react";
import type { TablesOf } from "@self-engine/db";
import type { SyncedTable } from "@self-engine/storage";
// A type only: the storage module's row map types the names, and stays out of the page.
import type { timeTrackingRowMap } from "./data/rows.ts";

/**
 * The names of the module's tables in the texts of a Refusal (D335), counted. The module's Shell
 * Contribution hands them to `dataTexts`.
 */
export const timeTrackingTableNames = {
  time_entries: (count) => msg`${plural(count, { one: "time entry", other: "time entries" })}`,
  timers: (count) => msg`${plural(count, { one: "timer", other: "timers" })}`,
} satisfies TableNames<SyncedTable<TablesOf<typeof timeTrackingRowMap>>>;
