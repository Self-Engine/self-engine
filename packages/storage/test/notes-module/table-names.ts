import type { MessageDescriptor } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import type { TablesOf } from "@self-engine/db";
import type { SyncedTable } from "../../src/core/convention.ts";
import type { notesRowMap } from "./data/rows.ts";

export const notesTableNames = {
  notes: (count) => msg`${plural(count, { one: "note", other: "notes" })}`,
} satisfies Readonly<
  Record<SyncedTable<TablesOf<typeof notesRowMap>>, (count: number) => MessageDescriptor>
>;
