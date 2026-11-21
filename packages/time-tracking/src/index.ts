import { msg } from "@lingui/core/macro";
import { dataTexts } from "@self-engine/data-client/react";
import { TimeIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";
// A type only: the storage module stays out of the start; its tables type the texts.
import type { timeTracking } from "./data/index.ts";
import { indicator } from "./indicator-entry.ts";
import { timeTrackingTableNames } from "./table-names.ts";

const newTimeEntry = {
  id: "new-time-entry",
  kind: "page",
  label: msg`New time entry`,
  defaultShortcut: "Mod+N",
  load: () => import("./new-time-entry.ts"),
} as const satisfies ShellCommand;

/** Creates a Time Entry without the form, for a later assistant (D85). */
const createTimeEntry = {
  id: "create-time-entry",
  kind: "input",
  load: () => import("./create-time-entry.ts"),
} as const satisfies ShellCommand;

const startTimer = {
  id: "start-timer",
  kind: "open",
  label: msg`Start timer`,
  load: () => import("./start-timer.ts"),
} as const satisfies ShellCommand;

const stopTimer = {
  id: "stop-timer",
  kind: "open",
  label: msg`Stop timer`,
  load: () => import("./stop-timer.ts"),
} as const satisfies ShellCommand;

const toggleTimer = {
  id: "toggle-timer",
  kind: "open",
  label: msg`Toggle timer`,
  defaultShortcut: "Mod+Shift+K",
  load: () => import("./toggle-timer.ts"),
} as const satisfies ShellCommand;

const startTimerForProject = {
  id: "start-timer-for-project",
  kind: "input",
  load: () => import("./start-timer-for-project.ts"),
} as const satisfies ShellCommand;

const stopTimerById = {
  id: "stop-timer-by-id",
  kind: "input",
  load: () => import("./stop-timer-by-id.ts"),
} as const satisfies ShellCommand;

/** The Shell Contribution of `time-tracking` (#275): "Time" in the Navbar, opening the
 * week, and the timer's Module Indicator on every page (#349). */
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
  commands: [
    newTimeEntry,
    createTimeEntry,
    startTimer,
    stopTimer,
    toggleTimer,
    startTimerForProject,
    stopTimerById,
  ],
  primaryAction: newTimeEntry,
  editDrawer: () => import("./edit-drawer.tsx"),
  indicator,
});
