import { msg, plural } from "@lingui/core/macro";
import { dataTexts } from "@self-engine/data-client/react";
import { ProjectsIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";
// A type only: the storage module stays out of the start; its tables and rules type the texts.
import type { projects } from "./data/index.ts";

const newProject = {
  id: "new-project",
  kind: "page",
  label: msg`New project`,
  defaultShortcut: "Mod+N",
  load: () => import("./new-project.ts"),
} as const satisfies ShellCommand;

/** Creates a project without the form, for a later assistant (D85). */
const createProject = {
  id: "create-project",
  kind: "input",
  load: () => import("./create-project.ts"),
} as const satisfies ShellCommand;

/** The Shell Contribution of `projects` (#273): what the Navbar and the Command Palette show. */
export const contribution = defineContribution({
  id: "projects",
  name: msg`Projects`,
  icon: ProjectsIcon,
  color: "violet",
  dataTexts: dataTexts<typeof projects>()({
    tableNames: {
      projects: (count) => msg`${plural(count, { one: "project", other: "projects" })}`,
    },
  }),
  views: [
    {
      id: "active",
      title: msg({ message: "Active", context: "View title" }),
      load: () => import("./active.tsx"),
    },
    {
      id: "archive",
      title: msg({ message: "Archive", context: "View title" }),
      load: () => import("./archive.tsx"),
    },
  ],
  commands: [newProject, createProject],
  primaryAction: newProject,
  editDrawer: () => import("./edit-drawer.tsx"),
});
