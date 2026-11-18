import { msg, plural } from "@lingui/core/macro";
import type { TablesOf } from "@self-engine/db";
import { ProjectsIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand, type TableNames } from "@self-engine/shell";
import type { SyncedTable } from "@self-engine/storage";
import type { entriesRowMap } from "./data/rows.ts";

const createEntry = {
  id: "create-entry",
  kind: "page",
  label: msg`New entry`,
  defaultShortcut: "Mod+N",
  load: () => import("./create-entry.ts"),
} as const satisfies ShellCommand;

const addSampleEntry = {
  id: "add-sample-entry",
  kind: "open",
  label: msg`Add sample entry`,
  defaultShortcut: "Mod+Shift+E",
  load: () => import("./add-sample-entry.ts"),
} as const satisfies ShellCommand;

const createNamedEntry = {
  id: "create-named-entry",
  kind: "input",
  load: () => import("./create-named-entry.ts"),
} as const satisfies ShellCommand;

const loadEntries = () => import("./entries.tsx");

export const contribution = defineContribution({
  id: "placeholder-alpha",
  name: msg`Placeholder Alpha`,
  icon: ProjectsIcon,
  color: "blue",
  tableNames: {
    placeholder_alpha_entries: (count) => msg`${plural(count, { one: "entry", other: "entries" })}`,
  },
  views: [
    { id: "overview", title: msg`Overview`, load: loadEntries },
    {
      id: "archive",
      title: msg({ message: "Archive", context: "View title" }),
      load: loadEntries,
    },
  ],
  commands: [createEntry, addSampleEntry, createNamedEntry],
  primaryAction: createEntry,
  editDrawer: () => import("./edit-drawer.tsx"),
  groups: () => import("./groups.tsx"),
  sharedSearch: ["client"],
}) satisfies { readonly tableNames: TableNames<SyncedTable<TablesOf<typeof entriesRowMap>>> };
