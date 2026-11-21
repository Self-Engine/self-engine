import { msg } from "@lingui/core/macro";
import { dataTexts } from "@self-engine/data-client/react";
import { TimeIcon } from "@self-engine/icons";
import { defineContribution } from "@self-engine/shell";
// A type only: the storage module stays out of the start; its tables type the texts.
import type { timeTracking } from "./data/index.ts";
import { timeTrackingTableNames } from "./table-names.ts";

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
});
