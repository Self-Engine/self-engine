import { msg } from "@lingui/core/macro";
import { ProjectsIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";

const createEntry = {
  id: "create-entry",
  label: msg`New entry`,
  load: () => import("./create-entry.ts"),
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
  commands: [createEntry],
  primaryAction: createEntry,
  editDrawer: () => import("./edit-drawer.tsx"),
  groups: () => import("./groups.tsx"),
  sharedSearch: ["client"],
});
