import { msg, plural } from "@lingui/core/macro";
import type { TablesOf } from "@self-engine/db";
import type { TableNames } from "@self-engine/data-client/react";
import type { SyncedTable } from "@self-engine/storage";
import type { projectEntriesRowMap } from "./data/rows.ts";

export const projectEntriesTableNames = {
  project_entries: (count) =>
    msg`${plural(count, { one: "project entry", other: "project entries" })}`,
} satisfies TableNames<SyncedTable<TablesOf<typeof projectEntriesRowMap>>>;
