import { msg } from "@lingui/core/macro";
import { ProjectsIcon } from "@self-engine/icons";
import { defineContribution, type ShellCommand } from "@self-engine/shell";

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
  views: [
    {
      id: "active",
      title: msg({ message: "Active", context: "View title" }),
      load: () => import("./active.tsx"),
    },
  ],
  commands: [newProject, createProject],
  primaryAction: newProject,
  editDrawer: () => import("./edit-drawer.tsx"),
});
