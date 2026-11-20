import { msg, plural } from "@lingui/core/macro";
import { dataTexts } from "@self-engine/data-client/react";
import { ProjectsIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";
import type { placeholderAlpha } from "./data/index.ts";

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
  dataTexts: dataTexts<typeof placeholderAlpha>()({
    tableNames: {
      placeholder_alpha_entries: (count) =>
        msg`${plural(count, { one: "entry", other: "entries" })}`,
    },
  }),
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
  indicator: { load: () => import("./indicator/index.tsx") },
  sharedSearch: ["client"],
});
