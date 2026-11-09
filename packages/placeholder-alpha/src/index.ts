import { msg } from "@lingui/core/macro";
import { ProjectsIcon } from "@self-engine/icons";
import type { ShellContribution } from "@self-engine/shell";

export const contribution = {
  id: "placeholder-alpha",
  name: msg`Placeholder Alpha`,
  icon: ProjectsIcon,
  color: "blue",
  views: [
    { id: "overview", title: msg`Overview`, load: () => import("./entries.tsx") },
    { id: "archive", title: msg`Archive`, load: () => import("./entries.tsx") },
  ],
  groups: () => import("./groups.tsx"),
  sharedSearch: ["client"],
} satisfies ShellContribution;
