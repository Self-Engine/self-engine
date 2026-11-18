import { msg } from "@lingui/core/macro";
import { NO_DATA_TEXTS } from "@self-engine/data-client/react";
import { ProjectsIcon } from "@self-engine/icons";
import type { ShellContribution } from "@self-engine/shell";

export const contribution = {
  id: "placeholder-beta",
  name: msg`Placeholder Beta`,
  icon: ProjectsIcon,
  color: "teal",
  dataTexts: NO_DATA_TEXTS,
  views: [{ id: "overview", title: msg`Overview`, load: () => import("./overview.tsx") }],
} satisfies ShellContribution;
