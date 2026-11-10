import { msg } from "@lingui/core/macro";
import { ProjectsIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";

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
  load: () => import("./add-sample-entry.ts"),
} as const satisfies ShellCommand;

const createNamedEntry = {
  id: "create-named-entry",
  kind: "input",
  load: () => import("./create-named-entry.ts"),
} as const satisfies ShellCommand;

export const contribution = defineContribution({
  id: "placeholder-alpha",
  name: msg`Placeholder Alpha`,
  icon: ProjectsIcon,
  color: "blue",
  views: [
    { id: "overview", title: msg`Overview`, load: () => import("./entries.tsx") },
    {
      id: "archive",
      title: msg({ message: "Archive", context: "View title" }),
      load: () => import("./entries.tsx"),
    },
  ],
  commands: [createEntry, addSampleEntry, createNamedEntry],
  primaryAction: createEntry,
  editDrawer: () => import("./edit-drawer.tsx"),
  groups: () => import("./groups.tsx"),
  sharedSearch: ["client"],
});
