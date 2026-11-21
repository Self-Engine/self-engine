import { msg } from "@lingui/core/macro";
import { dataTexts } from "@self-engine/data-client/react";
import { TimeIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";
// A type only: the storage module stays out of the start; its tables type the texts.
import type { timeTracking } from "./data/index.ts";
import { timeTrackingTableNames } from "./table-names.ts";

const newTimeEntry = {
  id: "new-time-entry",
  kind: "page",
  label: msg`New time entry`,
  defaultShortcut: "Mod+N",
  load: () => import("./new-time-entry.ts"),
} as const satisfies ShellCommand;

/** Creates a time entry without the form, for a later assistant (D85). */
const createTimeEntry = {
  id: "create-time-entry",
  kind: "input",
  load: () => import("./create-time-entry.ts"),
} as const satisfies ShellCommand;

/** The Shell Contribution of `time-tracking` (#275): "Time" in the Navbar, opening the week. */
export const contribution = defineContribution({
  id: "time-tracking",
  name: msg`Time`,
  icon: TimeIcon,
  color: "cyan",
  dataTexts: dataTexts<typeof timeTracking>()({ tableNames: timeTrackingTableNames }),
  groups: () => import("./projects-group.tsx"),
  views: [
    {
      id: "week",
      title: msg({ message: "Week", context: "View title" }),
      load: () => import("./week.tsx"),
    },
  ],
  commands: [newTimeEntry, createTimeEntry],
  primaryAction: newTimeEntry,
  editDrawer: () => import("./edit-drawer.tsx"),
});
