import { msg } from "@lingui/core/macro";
import { ProjectsIcon } from "@self-engine/icons";
import type { ShellContribution } from "@self-engine/shell";

export const contribution = {
  id: "placeholder-beta",
  name: msg`Placeholder Beta`,
  icon: ProjectsIcon,
  color: "teal",
  views: [{ id: "overview", title: msg`Overview`, load: () => import("./overview.tsx") }],
} satisfies ShellContribution;
